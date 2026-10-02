import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const DB_PATH = path.join(process.cwd(), "smart_business_manager", "business.db");

// Password verification function compatible with Werkzeug / Python pbkdf2:sha256
function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash) return false;
    const parts = storedHash.split("$");
    if (parts.length === 3 && parts[0].startsWith("pbkdf2:sha256:")) {
      const iterations = parseInt(parts[0].split(":")[2], 10) || 600000;
      const salt = parts[1];
      const expectedHash = parts[2];
      const computed = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
    }
    return false;
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
}

// Helper to query SQLite database directly via Python runtime
function runPythonSqliteQuery(script: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile("python3", ["-c", script, ...args], { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error("Python SQLite query error:", stderr || error.message);
        reject(new Error(stderr || error.message));
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve(data);
      } catch (err) {
        resolve({ raw: stdout.trim() });
      }
    });
  });
}

// Initialize SQLite database tables and default admin user if not present
async function initializeDatabase() {
  const initScript = `
import sqlite3, os, hashlib, secrets, datetime

db_dir = 'smart_business_manager'
if not os.path.exists(db_dir):
    os.makedirs(db_dir)

db_path = os.path.join(db_dir, 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Users table
cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )
""")

# Check for admin
cur.execute("SELECT id FROM users WHERE username = ?", ('admin',))
if not cur.fetchone():
    salt = secrets.token_hex(16)
    iterations = 600000
    pwd_hash = hashlib.pbkdf2_hmac('sha256', b'admin123', salt.encode('utf-8'), iterations).hex()
    full_hash = "pbkdf2:sha256:" + str(iterations) + "$" + salt + "$" + pwd_hash
    cur.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", ('admin', full_hash))
    conn.commit()

# 2. Products table (Inventory & Stock Management)
cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        sku TEXT,
        price REAL DEFAULT 0.0,
        purchase_price REAL DEFAULT 0.0,
        stock_quantity INTEGER DEFAULT 0,
        min_stock_level INTEGER DEFAULT 5,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

cur.execute("PRAGMA table_info(products)")
product_cols = [c[1] for c in cur.fetchall()]
if 'sku' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN sku TEXT")
if 'purchase_price' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN purchase_price REAL DEFAULT 0.0")
if 'created_at' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN created_at TEXT")
if 'mrp' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN mrp REAL DEFAULT 0.0")
if 'discount_percent' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN discount_percent REAL DEFAULT 0.0")
if 'discount_amount' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN discount_amount REAL DEFAULT 0.0")
if 'discount_type' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN discount_type TEXT DEFAULT 'percentage'")
if 'max_stock_level' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN max_stock_level INTEGER DEFAULT 50")
if 'brand' not in product_cols:
    cur.execute("ALTER TABLE products ADD COLUMN brand TEXT DEFAULT ''")
conn.commit()

# Ensure existing products have realistic cost/purchase price if zero or null
cur.execute("UPDATE products SET purchase_price = ROUND(price * 0.65, 2) WHERE purchase_price IS NULL OR purchase_price = 0.0")
cur.execute("""
    UPDATE products 
    SET mrp = CASE WHEN mrp IS NULL OR mrp <= 0 THEN ROUND(price * 1.25, 2) ELSE mrp END,
        discount_amount = CASE WHEN mrp IS NOT NULL AND mrp > price THEN ROUND(mrp - price, 2) ELSE 0.0 END,
        discount_percent = CASE WHEN mrp IS NOT NULL AND mrp > price AND mrp > 0 THEN ROUND(((mrp - price) / mrp) * 100.0, 1) ELSE 0.0 END
    WHERE mrp IS NULL OR mrp <= 0 OR discount_amount IS NULL
""")
cur.execute("UPDATE products SET brand = 'Dell' WHERE (LOWER(name) LIKE '%monitor%' OR LOWER(name) LIKE '%screen%') AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'Steelcase' WHERE LOWER(name) LIKE '%chair%' AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'Honeywell' WHERE LOWER(name) LIKE '%scanner%' AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'Logitech' WHERE (LOWER(name) LIKE '%keyboard%' OR LOWER(name) LIKE '%mouse%') AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'Epson' WHERE (LOWER(name) LIKE '%receipt printer%' OR LOWER(name) LIKE '%paper roll%') AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'Brother' WHERE LOWER(name) LIKE '%label printer%' AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'Anker' WHERE LOWER(name) LIKE '%hub%' AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'APG Cash Drawer' WHERE LOWER(name) LIKE '%cash drawer%' AND (brand IS NULL OR brand = '')")
cur.execute("UPDATE products SET brand = 'General' WHERE brand IS NULL OR brand = ''")
conn.commit()

# 2b. Stock Movements / History table (Requirement 9 & 11)
cur.execute("""
    CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        movement_type TEXT NOT NULL, -- 'Stock Added', 'Sale', 'Adjustment', 'Restock', 'Sale Restored'
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        reference_id TEXT, -- e.g. INV-2026-0001, MANUAL, or REORDER
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

# Seed initial products if empty
cur.execute("SELECT COUNT(*) FROM products")
if cur.fetchone()[0] == 0:
    seed_products = [
        ('Ergonomic Office Chair', 'Furniture', 'CHR-001', 8500.0, 5600.0, 15, 3),
        ('Ultra HD Monitor 27"', 'Electronics', 'MON-027', 18999.0, 13200.0, 8, 2),
        ('POS Thermal Paper Roll (Box)', 'Supplies', 'SUP-102', 650.0, 390.0, 45, 10),
        ('Wireless Barcode Scanner 2D', 'Hardware', 'SCN-201', 3499.0, 2150.0, 12, 4),
        ('Mechanical Keyboard RGB', 'Accessories', 'ACC-305', 2800.0, 1750.0, 20, 5),
        ('Thermal Receipt Printer USB', 'Hardware', 'PRN-401', 5499.0, 3600.0, 7, 2),
        ('Wireless Optical Mouse', 'Accessories', 'ACC-101', 899.0, 480.0, 35, 8),
        ('Heavy Duty Cash Drawer', 'Hardware', 'CAS-501', 4200.0, 2750.0, 5, 2),
        ('USB-C Multiport Hub 8-in-1', 'Accessories', 'HUB-801', 2199.0, 1350.0, 2, 5),
        ('Bluetooth Label Printer', 'Hardware', 'LBL-301', 6999.0, 4400.0, 0, 3)
    ]
    cur.executemany("""
        INSERT INTO products (name, category, sku, price, purchase_price, stock_quantity, min_stock_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, seed_products)
else:
    # Ensure we have realistic items for low stock and out of stock demonstrations if needed
    cur.execute("SELECT COUNT(*) FROM products WHERE stock_quantity <= 0")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO products (name, category, sku, price, purchase_price, stock_quantity, min_stock_level)
            VALUES ('Bluetooth Label Printer', 'Hardware', 'LBL-301', 6999.0, 4400.0, 0, 3)
        """)
    cur.execute("SELECT COUNT(*) FROM products WHERE stock_quantity > 0 AND stock_quantity <= min_stock_level")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO products (name, category, sku, price, purchase_price, stock_quantity, min_stock_level)
            VALUES ('USB-C Multiport Hub 8-in-1', 'Accessories', 'HUB-801', 2199.0, 1350.0, 2, 5)
        """)

# Backfill initial stock movements if table is empty
cur.execute("SELECT COUNT(*) FROM stock_movements")
if cur.fetchone()[0] == 0:
    cur.execute("SELECT id, name, sku, stock_quantity FROM products")
    for prod_row in cur.fetchall():
        pid, pname, psku, pqty = prod_row[0], prod_row[1], prod_row[2], prod_row[3]
        if pqty > 0:
            cur.execute("""
                INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes, created_at)
                VALUES (?, ?, 'Stock Added', ?, 0, ?, 'INITIAL-INTAKE', 'Initial inventory stock intake', datetime('now', '-3 days'))
            """, (pid, pname, pqty, pqty))

# 3. Sales table
cur.execute("""
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        product_name TEXT,
        quantity INTEGER DEFAULT 1,
        subtotal REAL DEFAULT 0.0,
        discount REAL DEFAULT 0.0,
        tax_amount REAL DEFAULT 0.0,
        total_amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'Cash',
        payment_status TEXT DEFAULT 'Paid',
        sale_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

cur.execute("PRAGMA table_info(sales)")
sale_cols = [c[1] for c in cur.fetchall()]
for col_name, col_def in [
    ('invoice_no', 'TEXT'),
    ('customer_phone', 'TEXT'),
    ('subtotal', 'REAL DEFAULT 0.0'),
    ('discount', 'REAL DEFAULT 0.0'),
    ('tax_amount', 'REAL DEFAULT 0.0'),
    ('payment_method', "TEXT DEFAULT 'Cash'"),
    ('payment_status', "TEXT DEFAULT 'Paid'"),
    ('paid_amount', 'REAL DEFAULT 0.0'),
    ('pending_amount', 'REAL DEFAULT 0.0'),
    ('due_date', 'TEXT'),
    ('notes', 'TEXT'),
    ('created_at', 'TEXT')
]:
    if col_name not in sale_cols:
        cur.execute(f"ALTER TABLE sales ADD COLUMN {col_name} {col_def}")
conn.commit()

# Ensure business_settings table exists
cur.execute("""
    CREATE TABLE IF NOT EXISTS business_settings (
        id INTEGER PRIMARY KEY,
        business_name TEXT DEFAULT 'Smart Commerce Enterprises',
        currency TEXT DEFAULT 'INR (₹)',
        currency_symbol TEXT DEFAULT '₹',
        tax_rate REAL DEFAULT 18.0,
        low_stock_threshold INTEGER DEFAULT 5,
        discount_low_max REAL DEFAULT 5.0,
        discount_med_max REAL DEFAULT 20.0,
        discount_high_max REAL DEFAULT 40.0,
        invoice_prefix TEXT DEFAULT 'INV-',
        invoice_notes TEXT DEFAULT 'Thank you for your business!',
        notify_low_stock INTEGER DEFAULT 1,
        notify_out_of_stock INTEGER DEFAULT 1,
        notify_suspicious_discount INTEGER DEFAULT 1,
        notify_customer_dues INTEGER DEFAULT 1,
        notify_overdue INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")
cur.execute("INSERT OR IGNORE INTO business_settings (id) VALUES (1)")
conn.commit()

# 3b. Sale Items table for multi-product invoices
cur.execute("""
    CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        sku TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0.0,
        discount REAL DEFAULT 0.0,
        tax_rate REAL DEFAULT 0.0,
        total_price REAL NOT NULL DEFAULT 0.0
    )
""")

# 3c. Customers table
cur.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        gst_number TEXT,
        notes TEXT,
        total_orders INTEGER DEFAULT 0,
        total_purchases REAL DEFAULT 0.0,
        paid_amount REAL DEFAULT 0.0,
        pending_amount REAL DEFAULT 0.0,
        last_purchase_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

cur.execute("PRAGMA table_info(customers)")
cust_cols = [c[1] for c in cur.fetchall()]
for col_name, col_def in [
    ('address', 'TEXT'),
    ('gst_number', 'TEXT'),
    ('notes', 'TEXT'),
    ('total_orders', 'INTEGER DEFAULT 0'),
    ('paid_amount', 'REAL DEFAULT 0.0'),
    ('pending_amount', 'REAL DEFAULT 0.0'),
    ('created_at', 'TEXT')
]:
    if col_name not in cust_cols:
        cur.execute(f"ALTER TABLE customers ADD COLUMN {col_name} {col_def}")
conn.commit()

# Seed realistic initial sales and items if empty
cur.execute("SELECT COUNT(*) FROM sales")
if cur.fetchone()[0] == 0:
    sample_sales = [
        ('INV-2026-001', 'Sharma Enterprises', '+91 98201 23456', 'Ergonomic Office Chair', 2, 17000.0, 500.0, 2970.0, 19470.0, 'UPI', 'Paid', '2026-09-22', 'Corporate office order'),
        ('INV-2026-002', 'Green Leaf Cafe', '+91 97112 88492', 'POS Thermal Paper Roll (Box)', 4, 2600.0, 100.0, 450.0, 2950.0, 'Cash', 'Paid', '2026-09-22', 'Counter billing supplies'),
        ('INV-2026-003', 'Apex Tech Studio', '+91 99403 11223', 'Ultra HD Monitor 27"', 1, 18999.0, 999.0, 3240.0, 21240.0, 'Card', 'Paid', '2026-09-21', 'Design workstation'),
        ('INV-2026-004', 'Starlight Hospitality', '+91 98840 55667', 'Thermal Receipt Printer USB', 1, 5499.0, 0.0, 989.82, 6488.82, 'Credit', 'Pending', '2026-09-21', '30-day net payment terms'),
        ('INV-2026-005', 'Rajesh Kumar', '+91 94451 90812', 'Mechanical Keyboard RGB', 3, 8400.0, 400.0, 1440.0, 9440.0, 'UPI', 'Paid', '2026-09-20', 'Bulk lab purchase')
    ]
    for s in sample_sales:
        cur.execute("""
            INSERT INTO sales (invoice_no, customer_name, customer_phone, product_name, quantity, subtotal, discount, tax_amount, total_amount, payment_method, payment_status, sale_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, s)
        s_id = cur.lastrowid
        cur.execute("""
            INSERT INTO sale_items (sale_id, product_name, quantity, unit_price, discount, tax_rate, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (s_id, s[3], s[4], s[5]/s[4], s[6], 18.0, s[8]))
        cur.execute("""
            INSERT INTO customers (name, phone, total_purchases, last_purchase_date)
            VALUES (?, ?, ?, ?)
        """, (s[1], s[2], s[8], s[11]))

# If sale_items is empty but sales exist, backfill
cur.execute("SELECT COUNT(*) FROM sale_items")
if cur.fetchone()[0] == 0:
    cur.execute("SELECT id, product_name, quantity, total_amount, subtotal, discount FROM sales")
    for s_row in cur.fetchall():
        s_id = s_row[0]
        p_name = s_row[1] or "Store Product"
        qty = s_row[2] or 1
        tot = s_row[3] or 0.0
        cur.execute("""
            INSERT INTO sale_items (sale_id, product_name, quantity, unit_price, discount, tax_rate, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (s_id, p_name, qty, tot/max(1, qty), 0.0, 18.0, tot))

# Seed or enrich realistic Customer profiles
initial_customer_profiles = [
    ('Sharma Enterprises', '+91 98201 23456', 'accounts@sharmaent.in', 'Suite 402, Trade Tower, Bandra Kurla Complex, Mumbai, MH', '27AABCS1429B1Z8', 'Corporate retail enterprise. Regular bulk purchases on net banking/UPI.'),
    ('Green Leaf Cafe', '+91 97112 88492', 'contact@greenleafcafe.com', 'Shop 12, Galleria Market, Sector 28, Gurugram, HR', '06AAAAA0000A1Z5', 'Quick service cafe chain. Daily POS supplies and paper rolls.'),
    ('Apex Tech Studio', '+91 99403 11223', 'procurement@apexstudio.io', 'Floor 3, Cyber Gateway, Hitec City, Hyderabad, TS', '36AACCA1234F1ZA', 'Digital software lab. High-end display workstations and ergonomic accessories.'),
    ('Starlight Hospitality', '+91 98840 55667', 'billing@starlighthotels.in', '88 Marina Beach Road, Mylapore, Chennai, TN', '33AAECS5678K1Z2', 'Hotel chain partner. 30-day net credit terms for hardware billing equipment.'),
    ('Rajesh Kumar', '+91 94451 90812', 'rajesh.kumar94@gmail.com', 'Flat 204, Green Glen Layout, Bellandur, Bengaluru, KA', '', 'Software engineer & independent lab consultant. Direct UPI buyer.')
]

for cust_data in initial_customer_profiles:
    cur.execute("SELECT id FROM customers WHERE phone = ? OR LOWER(name) = LOWER(?)", (cust_data[1], cust_data[0]))
    c_row = cur.fetchone()
    if c_row:
        cur.execute("""
            UPDATE customers 
            SET email = COALESCE(NULLIF(email, ''), ?),
                address = COALESCE(NULLIF(address, ''), ?),
                gst_number = COALESCE(NULLIF(gst_number, ''), ?),
                notes = COALESCE(NULLIF(notes, ''), ?)
            WHERE id = ?
        """, (cust_data[2], cust_data[3], cust_data[4], cust_data[5], c_row[0]))
    else:
        cur.execute("""
            INSERT INTO customers (name, phone, email, address, gst_number, notes, total_orders, total_purchases, paid_amount, pending_amount)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0.0, 0.0, 0.0)
        """, (cust_data[0], cust_data[1], cust_data[2], cust_data[3], cust_data[4], cust_data[5]))

# Synchronize customer metrics dynamically from all sales
cur.execute("SELECT id, name, phone FROM customers")
for c_rec in cur.fetchall():
    cid, cname, cphone = c_rec[0], c_rec[1], c_rec[2]
    stats = cur.execute("""
        SELECT 
            COUNT(*),
            COALESCE(SUM(total_amount), 0.0),
            COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
            MAX(sale_date)
        FROM sales
        WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
           OR (LOWER(customer_name) = LOWER(?))
    """, (cphone, cname)).fetchone()

    if stats and stats[0] > 0:
        cur.execute("""
            UPDATE customers
            SET total_orders = ?,
                total_purchases = ?,
                paid_amount = ?,
                pending_amount = ?,
                last_purchase_date = ?
            WHERE id = ?
        """, (stats[0], stats[1], stats[2], stats[3], stats[4], cid))

# 4. Expenses table
cur.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT NOT NULL,
        payment_method TEXT DEFAULT 'UPI',
        notes TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

cur.execute("PRAGMA table_info(expenses)")
exp_cols = [c[1] for c in cur.fetchall()]
for col_name, col_def in [
    ('title', 'TEXT'),
    ('payment_method', "TEXT DEFAULT 'UPI'"),
    ('notes', 'TEXT'),
    ('created_at', 'TEXT')
]:
    if col_name not in exp_cols:
        cur.execute(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_def}")
conn.commit()

# Sync title and description
cur.execute("UPDATE expenses SET title = description WHERE (title IS NULL OR title = '') AND description IS NOT NULL AND description != ''")
cur.execute("UPDATE expenses SET description = title WHERE (description IS NULL OR description = '') AND title IS NOT NULL AND title != ''")
cur.execute("UPDATE expenses SET payment_method = 'UPI' WHERE payment_method IS NULL OR payment_method = ''")

# Seed realistic initial expenses if empty
cur.execute("SELECT COUNT(*) FROM expenses")
if cur.fetchone()[0] == 0:
    today_str = datetime.date.today().isoformat()
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    three_days_ago = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()
    five_days_ago = (datetime.date.today() - datetime.timedelta(days=5)).isoformat()
    ten_days_ago = (datetime.date.today() - datetime.timedelta(days=10)).isoformat()

    seed_expenses = [
        ('Commercial Office & Warehouse Rent', 'Rent', 25000.0, ten_days_ago, 'Net Banking', 'Monthly corporate space lease payment'),
        ('High-Speed Commercial Fiber Internet', 'Internet', 1499.0, five_days_ago, 'UPI', 'AirTel Xstream Fiber 300 Mbps unlimited plan'),
        ('State Commercial Electricity Utility', 'Electricity', 4350.0, three_days_ago, 'UPI', 'Showroom lighting, cooling, and equipment power bill'),
        ('Local Logistics & Stock Transport', 'Transport', 1850.0, yesterday_str, 'Cash', 'Tempo delivery from central wholesale freight hub'),
        ('Showroom Lighting & AC Maintenance', 'Maintenance', 2400.0, yesterday_str, 'UPI', 'Quarterly AC servicing and replacement of shop spotlight LEDs'),
        ('Bulk Packaging & POS Supplies', 'Stock Purchase', 12500.0, today_str, 'Net Banking', 'Procurement of thermal paper rolls, bubble wraps, and bags'),
        ('Google Ads & Local Meta Promotions', 'Marketing', 5000.0, today_str, 'Card', 'Targeted local outreach for retail accessories')
    ]
    for exp in seed_expenses:
        cur.execute("""
            INSERT INTO expenses (title, category, amount, expense_date, payment_method, notes, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (exp[0], exp[1], exp[2], exp[3], exp[4], exp[5], exp[0]))

# 5. Employees table
cur.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        role TEXT,
        department TEXT,
        salary REAL DEFAULT 0.0,
        joining_date TEXT,
        status TEXT DEFAULT 'Active'
    )
""")

# Migrate existing table if columns are missing
cur.execute("PRAGMA table_info(employees)")
existing_cols = [c[1] for c in cur.fetchall()]
if 'phone' not in existing_cols:
    cur.execute("ALTER TABLE employees ADD COLUMN phone TEXT")
if 'email' not in existing_cols:
    cur.execute("ALTER TABLE employees ADD COLUMN email TEXT")
if 'joining_date' not in existing_cols:
    cur.execute("ALTER TABLE employees ADD COLUMN joining_date TEXT")
if 'status' not in existing_cols:
    cur.execute("ALTER TABLE employees ADD COLUMN status TEXT DEFAULT 'Active'")

# Seed realistic initial employees if empty
cur.execute("SELECT COUNT(*) FROM employees")
if cur.fetchone()[0] == 0:
    seed_employees = [
        ('Sarah Jenkins', '+91 98765 43210', 'sarah.j@smartbiz.local', 'Store Manager', 'Management', 720000.0, '2023-01-15', 'Active'),
        ('David Chen', '+91 98123 45678', 'david.c@smartbiz.local', 'Sales Associate', 'Sales & Billing', 480000.0, '2023-06-20', 'Active'),
        ('Maria Rodriguez', '+91 98456 78901', 'maria.r@smartbiz.local', 'Inventory Specialist', 'Warehouse & Logistics', 520000.0, '2023-11-10', 'Active'),
        ('Marcus Vance', '+91 98901 23456', 'marcus.v@smartbiz.local', 'Customer Support Lead', 'Operations', 460000.0, '2024-02-01', 'Active'),
        ('Chloe Bennett', '+91 98345 67890', 'chloe.b@smartbiz.local', 'Bookkeeper / Accountant', 'Finance', 600000.0, '2024-04-18', 'Inactive')
    ]
    cur.executemany("""
        INSERT INTO employees (name, phone, email, role, department, salary, joining_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, seed_employees)

# 6. Suppliers table (Supplier & Vendor Management)
cur.execute("""
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company_name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        email TEXT,
        address TEXT,
        notes TEXT,
        total_purchases REAL DEFAULT 0.0,
        last_purchase_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

# 6b. Supplier Purchases / Orders table
cur.execute("""
    CREATE TABLE IF NOT EXISTS supplier_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        purchase_order_no TEXT,
        invoice_no TEXT,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_cost REAL NOT NULL DEFAULT 0.0,
        total_amount REAL NOT NULL DEFAULT 0.0,
        purchase_date TEXT NOT NULL,
        payment_status TEXT DEFAULT 'Paid',
        payment_method TEXT DEFAULT 'Net Banking',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
""")

cur.execute("PRAGMA table_info(supplier_purchases)")
sp_cols = [c[1] for c in cur.fetchall()]
if 'invoice_no' not in sp_cols:
    cur.execute("ALTER TABLE supplier_purchases ADD COLUMN invoice_no TEXT")
cur.execute("UPDATE supplier_purchases SET invoice_no = purchase_order_no WHERE invoice_no IS NULL OR invoice_no = ''")
conn.commit()

# Connect suppliers to real existing inventory/purchase records (Requirement 8 & 9)
cur.execute("SELECT COUNT(*) FROM suppliers")
if cur.fetchone()[0] == 0:
    seed_suppliers = [
        ('Rajesh Verma', 'Metro Electronics Distribution', '+91 98111 22334', 'sales@metroelectronics.in', 'Warehouse 14, Okhla Industrial Area Phase 3, New Delhi', 'Primary distributor for display monitors, barcode scanners, and POS receipt printers.'),
        ('Sunita Rao', 'ErgoTech Furniture Hub', '+91 98222 33445', 'procurement@ergotech.co.in', 'Plot 52, GIDC Electronic Zone, Gandhinagar, Gujarat', 'Manufacturer & wholesale supplier of ergonomic office seating and desks.'),
        ('Vikram Patel', 'PaperKraft Logistics & Supplies', '+91 98333 55667', 'orders@paperkraft.in', 'Unit 8, Bhiwandi Logistics Park, Thane, Maharashtra', 'Wholesale supplier of packaging materials, cartons, and thermal paper rolls.'),
        ('Anil Mehta', 'Apex Peripherals & Components', '+91 98444 66778', 'b2b@apexperipherals.com', 'Floor 2, SP Infocity, Perungudi, Chennai, Tamil Nadu', 'Direct OEM importer of mechanical keyboards, USB hubs, and wireless mice.'),
        ('Priya Sharma', 'Zenith Retail Importers', '+91 98555 77889', 'priya@zenithretail.org', 'Tower B, DLF Cyber City, Phase 2, Gurugram, Haryana', 'New vendor onboarding for overseas retail accessories. No purchase orders placed yet.')
    ]
    for s_name, s_comp, s_mob, s_email, s_addr, s_notes in seed_suppliers:
        cur.execute("""
            INSERT INTO suppliers (name, company_name, mobile, email, address, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (s_name, s_comp, s_mob, s_email, s_addr, s_notes))
    conn.commit()

    # Link real existing product purchases / stock intake into supplier_purchases
    cur.execute("SELECT id, company_name FROM suppliers")
    sup_map = {row[1]: row[0] for row in cur.fetchall()}

    # Connect Metro Electronics
    if 'Metro Electronics Distribution' in sup_map:
        m_id = sup_map['Metro Electronics Distribution']
        cur.execute("""
            INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
            VALUES (?, 'PO-2026-081', 'Ultra HD Monitor 27\"', 8, 13200.0, 105600.0, '2026-09-18', 'Paid', 'Net Banking', 'Quarterly display stock intake')
        """, (m_id,))
        cur.execute("""
            INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
            VALUES (?, 'PO-2026-089', 'Wireless Barcode Scanner 2D', 12, 2150.0, 25800.0, '2026-09-20', 'Paid', 'Net Banking', 'Scanner batch intake')
        """, (m_id,))

    # Connect ErgoTech Furniture Hub
    if 'ErgoTech Furniture Hub' in sup_map:
        e_id = sup_map['ErgoTech Furniture Hub']
        cur.execute("""
            INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
            VALUES (?, 'PO-2026-074', 'Ergonomic Office Chair', 15, 5600.0, 84000.0, '2026-09-17', 'Paid', 'Net Banking', 'Initial showroom chair batch')
        """, (e_id,))

    # Connect PaperKraft Logistics & Supplies (corresponds to real expense record "Bulk Packaging & POS Supplies" and paper stock)
    if 'PaperKraft Logistics & Supplies' in sup_map:
        p_id = sup_map['PaperKraft Logistics & Supplies']
        cur.execute("""
            INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
            VALUES (?, 'PO-2026-092', 'Bulk Packaging & POS Supplies', 1, 12500.0, 12500.0, '2026-09-23', 'Paid', 'Net Banking', 'Store packaging materials and rolls')
        """, (p_id,))
        cur.execute("""
            INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
            VALUES (?, 'PO-2026-085', 'POS Thermal Paper Roll (Box)', 45, 390.0, 17550.0, '2026-09-19', 'Paid', 'UPI', 'Thermal paper box restock')
        """, (p_id,))

    # Connect Apex Peripherals & Components
    if 'Apex Peripherals & Components' in sup_map:
        a_id = sup_map['Apex Peripherals & Components']
        cur.execute("""
            INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
            VALUES (?, 'PO-2026-088', 'Mechanical Keyboard RGB', 20, 1750.0, 35000.0, '2026-09-19', 'Paid', 'Card', 'Gaming & office keyboard batch')
        """, (a_id,))

    conn.commit()

# Recalculate supplier purchase metrics from supplier_purchases (Requirement 9)
cur.execute("SELECT id FROM suppliers")
for s_rec in cur.fetchall():
    s_id = s_rec[0]
    p_stats = cur.execute("""
        SELECT 
            COALESCE(SUM(total_amount), 0.0),
            MAX(purchase_date)
        FROM supplier_purchases
        WHERE supplier_id = ?
    """, (s_id,)).fetchone()

    cur.execute("""
        UPDATE suppliers
        SET total_purchases = ?,
            last_purchase_date = ?
        WHERE id = ?
    """, (p_stats[0] if p_stats else 0.0, p_stats[1] if (p_stats and p_stats[1]) else None, s_id))

conn.commit()

conn.commit()
conn.close()
print('{"initialized": true}')
`;
  try {
    await runPythonSqliteQuery(initScript);
    console.log("SQLite database initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
  }
}

async function startServer() {
  await initializeDatabase();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Favicon handler to avoid 404 in preview console
  app.get("/favicon.ico", (_req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`);
  });

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Smart Business Manager Server" });
  });

  // SQLite User Authentication (Login)
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Please enter both username and password." });
    }

    const queryScript = `
import sqlite3, json, sys, os

username = sys.argv[1]
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

row = cur.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,)).fetchone()
conn.close()

if row:
    print(json.dumps({
        'found': True,
        'user': {'id': row['id'], 'username': row['username'], 'password_hash': row['password_hash']}
    }))
else:
    print(json.dumps({'found': False}))
`;

    try {
      const result = await runPythonSqliteQuery(queryScript, [username.trim()]);
      if (!result || !result.found || !result.user) {
        return res.status(401).json({ success: false, error: "Invalid username or password. Please try again." });
      }

      const isMatch = verifyPassword(password, result.user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: "Invalid username or password. Please try again." });
      }

      return res.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username
        }
      });
    } catch (err: any) {
      console.error("Login SQLite query error:", err);
      return res.status(500).json({ success: false, error: "Database authentication error. Please try again." });
    }
  });

  // Logout API
  app.post("/api/logout", (_req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
  });

  // Get real SQLite metrics (Requirement 3, 4, 5, 6, 7 & Sales Dashboard)
  app.get("/api/metrics", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, datetime, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def table_exists(tbl):
    return cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (tbl,)).fetchone() is not None

today_str = datetime.date.today().isoformat()

today_sales = 0.0
today_orders = 0
total_sales = 0.0
pending_payments = 0.0

if table_exists('sales'):
    try:
        row = cur.execute("SELECT COALESCE(SUM(total_amount), 0.0) as total, COUNT(*) as orders FROM sales WHERE date(sale_date) = date(?)", (today_str,)).fetchone()
        today_sales = float(row['total']) if row and row['total'] is not None else 0.0
        today_orders = int(row['orders']) if row and row['orders'] is not None else 0

        row_tot = cur.execute("SELECT COALESCE(SUM(total_amount), 0.0) as total FROM sales").fetchone()
        total_sales = float(row_tot['total']) if row_tot and row_tot['total'] is not None else 0.0

        row_pending = cur.execute("SELECT COALESCE(SUM(total_amount), 0.0) as pending FROM sales WHERE LOWER(COALESCE(payment_status, 'Paid')) != 'paid'").fetchone()
        pending_payments = float(row_pending['pending']) if row_pending and row_pending['pending'] is not None else 0.0
    except:
        today_sales = 0.0
        today_orders = 0
        total_sales = 0.0
        pending_payments = 0.0

today_expenses = 0.0
total_expenses = 0.0
if table_exists('expenses'):
    try:
        row = cur.execute("SELECT COALESCE(SUM(amount), 0.0) as total FROM expenses WHERE date(expense_date) = date(?)", (today_str,)).fetchone()
        today_expenses = float(row['total']) if row and row['total'] is not None else 0.0

        row_all_exp = cur.execute("SELECT COALESCE(SUM(amount), 0.0) as total FROM expenses").fetchone()
        total_expenses = float(row_all_exp['total']) if row_all_exp and row_all_exp['total'] is not None else 0.0
    except:
        today_expenses = 0.0
        total_expenses = 0.0

# Calculate COGS using real product cost prices (Requirement 8)
product_cost_map = {}
if table_exists('products'):
    for p in cur.execute("SELECT id, LOWER(TRIM(name)) as lname, purchase_price, price FROM products").fetchall():
        cost = float(p['purchase_price'] or 0.0)
        if cost <= 0 and p['price'] and float(p['price']) > 0:
            cost = round(float(p['price']) * 0.70, 2)
        product_cost_map[p['id']] = cost
        product_cost_map[p['lname']] = cost

total_cogs = 0.0
today_cogs = 0.0
if table_exists('sale_items'):
    for si in cur.execute("""
        SELECT si.product_id, si.product_name, si.quantity, si.unit_price, s.sale_date
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
    """).fetchall():
        qty = int(si['quantity'] or 1)
        pid = si['product_id']
        pname = (si['product_name'] or '').lower().strip()
        cost_unit = product_cost_map.get(pid) or product_cost_map.get(pname)
        if not cost_unit or cost_unit <= 0:
            cost_unit = round(float(si['unit_price'] or 0.0) * 0.70, 2)
        cogs_val = round(qty * cost_unit, 2)
        total_cogs += cogs_val
        if si['sale_date'] and si['sale_date'].startswith(today_str):
            today_cogs += cogs_val

gross_profit = round(total_sales - total_cogs, 2)
total_profit = round(gross_profit - total_expenses, 2)

today_gross = round(today_sales - today_cogs, 2)
today_profit = round(today_gross - today_expenses, 2)

profit_margin = round((total_profit / total_sales * 100), 2) if total_sales > 0 else 0.0
gross_margin = round((gross_profit / total_sales * 100), 2) if total_sales > 0 else 0.0

total_products = 0
total_stock_items = 0
total_inventory_value = 0.0
total_inventory_cost = 0.0
low_stock_count = 0
out_of_stock_count = 0
low_stock_products = []
if table_exists('products'):
    try:
        row = cur.execute("SELECT COUNT(*) as c, COALESCE(SUM(stock_quantity), 0) as s FROM products").fetchone()
        total_products = int(row['c']) if row else 0
        total_stock_items = int(row['s']) if row else 0

        row_val = cur.execute("""
            SELECT COALESCE(SUM(stock_quantity * price), 0.0) as retail_val,
                   COALESCE(SUM(stock_quantity * COALESCE(purchase_price, ROUND(price * 0.65, 2))), 0.0) as cost_val
            FROM products
            WHERE stock_quantity > 0
        """).fetchone()
        if row_val:
            total_inventory_value = round(float(row_val['retail_val'] or 0.0), 2)
            total_inventory_cost = round(float(row_val['cost_val'] or 0.0), 2)

        row_oos = cur.execute("SELECT COUNT(*) as c FROM products WHERE stock_quantity <= 0").fetchone()
        out_of_stock_count = int(row_oos['c']) if row_oos else 0

        row_low = cur.execute("SELECT COUNT(*) as c FROM products WHERE stock_quantity > 0 AND stock_quantity <= min_stock_level").fetchone()
        low_stock_count = int(row_low['c']) if row_low else 0

        row_over = cur.execute("SELECT COUNT(*) as c FROM products WHERE max_stock_level IS NOT NULL AND max_stock_level > 0 AND stock_quantity > max_stock_level").fetchone()
        overstock_count = int(row_over['c']) if row_over else 0

        row_susp = cur.execute("SELECT COUNT(*) as c FROM products WHERE discount_percent >= 40.0").fetchone()
        suspicious_discounts_count = int(row_susp['c']) if row_susp else 0

        rows = cur.execute("""
            SELECT id, name, sku, category, price, purchase_price, stock_quantity, min_stock_level,
                   COALESCE(max_stock_level, 50) as max_stock_level,
                   COALESCE(supplier, '') as supplier,
                   CASE 
                       WHEN stock_quantity <= 0 THEN 'Out of Stock'
                       WHEN stock_quantity <= min_stock_level THEN 'Low Stock'
                       WHEN max_stock_level IS NOT NULL AND max_stock_level > 0 AND stock_quantity > max_stock_level THEN 'Overstock'
                       ELSE 'In Stock'
                   END as status
            FROM products 
            WHERE stock_quantity <= min_stock_level 
            ORDER BY stock_quantity ASC
        """).fetchall()
        low_stock_products = [dict(r) for r in rows]
    except:
        total_products = 0
        total_stock_items = 0
        total_inventory_value = 0.0
        total_inventory_cost = 0.0
        low_stock_count = 0
        out_of_stock_count = 0
        overstock_count = 0
        suspicious_discounts_count = 0
        low_stock_products = []

total_purchases = 0.0
if table_exists('supplier_purchases'):
    try:
        r_pur = cur.execute("SELECT COALESCE(SUM(total_amount), 0.0) as t FROM supplier_purchases").fetchone()
        total_purchases = float(r_pur['t']) if r_pur and r_pur['t'] is not None else 0.0
    except:
        total_purchases = 0.0

total_customers = 0
pending_customer_dues = 0.0
if table_exists('customers'):
    try:
        r_cust = cur.execute("SELECT COUNT(*) as c, COALESCE(SUM(pending_amount), 0.0) as p FROM customers").fetchone()
        total_customers = int(r_cust['c']) if r_cust else 0
        pending_customer_dues = float(r_cust['p']) if r_cust and r_cust['p'] is not None else 0.0
    except:
        total_customers = 0
        pending_customer_dues = 0.0

total_suppliers = 0
if table_exists('suppliers'):
    try:
        r_sup = cur.execute("SELECT COUNT(*) as c FROM suppliers").fetchone()
        total_suppliers = int(r_sup['c']) if r_sup else 0
    except:
        total_suppliers = 0

total_employees = 0
active_employees = 0
inactive_employees = 0
monthly_payroll = 0.0
if table_exists('employees'):
    try:
        row = cur.execute("SELECT COUNT(*) as c FROM employees").fetchone()
        total_employees = int(row['c']) if row else 0

        row_act = cur.execute("SELECT COUNT(*) as c FROM employees WHERE LOWER(COALESCE(status, 'Active')) = 'active'").fetchone()
        active_employees = int(row_act['c']) if row_act else 0

        row_inact = cur.execute("SELECT COUNT(*) as c FROM employees WHERE LOWER(COALESCE(status, 'Active')) != 'active'").fetchone()
        inactive_employees = int(row_inact['c']) if row_inact else 0

        row_pay = cur.execute("SELECT COALESCE(SUM(salary), 0.0) as tot FROM employees WHERE LOWER(COALESCE(status, 'Active')) = 'active'").fetchone()
        annual_pay = float(row_pay['tot']) if row_pay and row_pay['tot'] is not None else 0.0
        monthly_payroll = round(annual_pay / 12.0, 2)
    except:
        total_employees = 0
        active_employees = 0
        inactive_employees = 0
        monthly_payroll = 0.0

recent_sales = []
if table_exists('sales'):
    try:
        rows = cur.execute("""
            SELECT id, invoice_no, customer_name, customer_phone, product_name, quantity, total_amount, payment_method, payment_status, sale_date
            FROM sales ORDER BY id DESC LIMIT 15
        """).fetchall()
        recent_sales = [dict(r) for r in rows]
    except:
        recent_sales = []

chart_data = []
for i in range(6, -1, -1):
    day = datetime.date.today() - datetime.timedelta(days=i)
    day_str = day.isoformat()
    lbl = day.strftime('%b %d')
    s = 0.0
    e = 0.0
    if table_exists('sales'):
        try:
            r = cur.execute("SELECT COALESCE(SUM(total_amount), 0.0) as t FROM sales WHERE date(sale_date) = date(?)", (day_str,)).fetchone()
            s = float(r['t']) if r and r['t'] is not None else 0.0
        except:
            s = 0.0
    if table_exists('expenses'):
        try:
            r_exp = cur.execute("SELECT COALESCE(SUM(amount), 0.0) as t FROM expenses WHERE date(expense_date) = date(?)", (day_str,)).fetchone()
            e = float(r_exp['t']) if r_exp and r_exp['t'] is not None else 0.0
        except:
            e = 0.0
    chart_data.append({
        'date': day_str,
        'label': lbl,
        'sales': round(s, 2),
        'expenses': round(e, 2),
        'profit': round(s - e, 2),
        'total': round(s, 2)
    })

conn.close()

print(json.dumps({
    'today_sales': round(today_sales, 2),
    'today_orders': today_orders,
    'total_sales': round(total_sales, 2),
    'total_revenue': round(total_sales, 2),
    'total_purchases': round(total_purchases, 2),
    'pending_payments': round(pending_payments, 2),
    'today_expenses': round(today_expenses, 2),
    'total_expenses': round(total_expenses, 2),
    'total_cogs': round(total_cogs, 2),
    'today_cogs': round(today_cogs, 2),
    'gross_profit': gross_profit,
    'gross_margin': gross_margin,
    'profit_margin': profit_margin,
    'today_profit': today_profit,
    'total_profit': total_profit,
    'total_products': total_products,
    'total_customers': total_customers,
    'total_suppliers': total_suppliers,
    'pending_customer_dues': round(pending_customer_dues, 2),
    'total_stock_items': total_stock_items,
    'total_inventory_value': total_inventory_value,
    'total_inventory_cost': total_inventory_cost,
    'low_stock_count': low_stock_count,
    'out_of_stock_count': out_of_stock_count,
    'overstock_count': overstock_count,
    'suspicious_discounts_count': suspicious_discounts_count,
    'low_stock_products': low_stock_products,
    'total_employees': total_employees,
    'active_employees': active_employees,
    'inactive_employees': inactive_employees,
    'monthly_payroll': monthly_payroll,
    'recent_sales': recent_sales,
    'chart_data': chart_data
}))
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      const safeData = {
        today_sales: data?.today_sales ?? 0,
        today_orders: data?.today_orders ?? 0,
        total_sales: data?.total_sales ?? 0,
        total_revenue: data?.total_revenue ?? (data?.total_sales ?? 0),
        total_purchases: data?.total_purchases ?? 0,
        pending_payments: data?.pending_payments ?? 0,
        today_expenses: data?.today_expenses ?? 0,
        total_expenses: data?.total_expenses ?? 0,
        total_cogs: data?.total_cogs ?? 0,
        today_cogs: data?.today_cogs ?? 0,
        gross_profit: data?.gross_profit ?? 0,
        gross_margin: data?.gross_margin ?? 0,
        profit_margin: data?.profit_margin ?? 0,
        today_profit: data?.today_profit ?? 0,
        total_profit: data?.total_profit ?? 0,
        total_products: data?.total_products ?? 0,
        total_customers: data?.total_customers ?? 0,
        total_suppliers: data?.total_suppliers ?? 0,
        pending_customer_dues: data?.pending_customer_dues ?? 0,
        total_stock_items: data?.total_stock_items ?? 0,
        total_inventory_value: data?.total_inventory_value ?? 0,
        total_inventory_cost: data?.total_inventory_cost ?? 0,
        low_stock_count: data?.low_stock_count ?? 0,
        out_of_stock_count: data?.out_of_stock_count ?? 0,
        overstock_count: data?.overstock_count ?? 0,
        suspicious_discounts_count: data?.suspicious_discounts_count ?? 0,
        low_stock_products: Array.isArray(data?.low_stock_products) ? data.low_stock_products : [],
        total_employees: data?.total_employees ?? 0,
        active_employees: data?.active_employees ?? 0,
        inactive_employees: data?.inactive_employees ?? 0,
        monthly_payroll: data?.monthly_payroll ?? 0,
        recent_sales: Array.isArray(data?.recent_sales) ? data.recent_sales : [],
        chart_data: Array.isArray(data?.chart_data) ? data.chart_data : []
      };
      res.json(safeData);
    } catch (err: any) {
      res.status(500).json({
        today_sales: 0,
        today_orders: 0,
        total_sales: 0,
        total_revenue: 0,
        pending_payments: 0,
        today_expenses: 0,
        today_profit: 0,
        total_profit: 0,
        total_products: 0,
        low_stock_count: 0,
        low_stock_products: [],
        total_employees: 0,
        recent_sales: [],
        chart_data: [],
        error: err.message
      });
    }
  });

  // ================= SALES & BILLING CRUD API =================
  // GET: Fetch all sales with items from SQLite
  app.get("/api/sales", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    rows = cur.execute("""
        SELECT id, invoice_no, customer_name, customer_phone, product_name, quantity,
               subtotal, discount, tax_amount, total_amount, payment_method,
               payment_status, sale_date, notes, created_at
        FROM sales
        ORDER BY id DESC
    """).fetchall()

    sales = []
    for r in rows:
        item = dict(r)
        # Fetch associated items
        items_rows = cur.execute("""
            SELECT id, sale_id, product_id, product_name, sku, quantity, unit_price, discount, tax_rate, total_price
            FROM sale_items
            WHERE sale_id = ?
            ORDER BY id ASC
        """, (item['id'],)).fetchall()

        sale_items = [dict(it) for it in items_rows]
        if not sale_items:
            # Fallback single item
            sale_items = [{
                'id': 1,
                'sale_id': item['id'],
                'product_name': item.get('product_name') or 'Item',
                'sku': '',
                'quantity': item.get('quantity') or 1,
                'unit_price': (item.get('subtotal') or item.get('total_amount') or 0.0) / max(1, item.get('quantity') or 1),
                'discount': item.get('discount') or 0.0,
                'tax_rate': 18.0,
                'total_price': item.get('total_amount') or 0.0
            }]
        item['items'] = sale_items
        sales.append(item)

    print(json.dumps({'success': True, 'sales': sales}))
except Exception as e:
    print(json.dumps({'success': False, 'sales': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/sales error:", err);
      res.status(500).json({ success: false, sales: [], error: err.message });
    }
  });

  // POST: Record New Sale with stock verification, stock reduction, multi-products & customer updates
  app.post("/api/sales", async (req, res) => {
    const {
      customer_name,
      customer_phone,
      items,
      subtotal,
      discount,
      tax_amount,
      total_amount,
      payment_method,
      payment_status,
      sale_date,
      notes
    } = req.body || {};

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, error: "Customer Name is required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "At least one product item is required for the invoice." });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_name || !item.product_name.trim()) {
        return res.status(400).json({ success: false, error: `Product name in line #${i + 1} cannot be empty.` });
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        return res.status(400).json({ success: false, error: `Quantity for '${item.product_name}' must be greater than 0.` });
      }
      if (item.unit_price === undefined || Number(item.unit_price) < 0) {
        return res.status(400).json({ success: false, error: `Price for '${item.product_name}' cannot be negative.` });
      }
    }

    const payload = {
      customer_name: customer_name.trim(),
      customer_phone: customer_phone ? customer_phone.trim() : "",
      items: items.map((it: any) => ({
        product_id: it.product_id ? parseInt(it.product_id, 10) : null,
        product_name: it.product_name.trim(),
        sku: it.sku ? it.sku.trim() : "",
        quantity: parseInt(it.quantity, 10) || 1,
        unit_price: parseFloat(it.unit_price) || 0.0,
        discount: parseFloat(it.discount) || 0.0,
        tax_rate: parseFloat(it.tax_rate) !== undefined ? parseFloat(it.tax_rate) : 18.0,
        total_price: parseFloat(it.total_price) || 0.0
      })),
      subtotal: parseFloat(subtotal) || 0.0,
      discount: parseFloat(discount) || 0.0,
      tax_amount: parseFloat(tax_amount) || 0.0,
      total_amount: parseFloat(total_amount) || 0.0,
      payment_method: payment_method || "Cash",
      payment_status: payment_status || "Paid",
      sale_date: sale_date && sale_date.trim() ? sale_date.trim() : new Date().toISOString().split("T")[0],
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # 1. Verify stock for all items first
    for item in args['items']:
        p_id = item.get('product_id')
        p_name = item.get('product_name', '').strip()
        req_qty = item.get('quantity', 1)

        prod = None
        if p_id:
            prod = cur.execute("SELECT id, name, stock_quantity FROM products WHERE id = ?", (p_id,)).fetchone()
        if not prod and p_name:
            prod = cur.execute("SELECT id, name, stock_quantity FROM products WHERE LOWER(name) = LOWER(?)", (p_name,)).fetchone()

        if prod:
            current_stock = prod['stock_quantity'] if prod['stock_quantity'] is not None else 0
            if current_stock <= 0:
                print(json.dumps({
                    'success': False,
                    'error': f"Cannot complete sale: '{prod['name']}' is Out of Stock (0 units available in inventory)."
                }))
                sys.exit(0)
            if req_qty > current_stock:
                print(json.dumps({
                    'success': False,
                    'error': f"Cannot complete sale: Insufficient stock for '{prod['name']}'. Only {current_stock} units available in inventory, requested: {req_qty} units."
                }))
                sys.exit(0)

    # 2. Generate sequential invoice number (e.g. INV-2026-0001)
    cur.execute("SELECT COUNT(*) FROM sales")
    count_val = cur.fetchone()[0] + 1
    invoice_no = f"INV-2026-{count_val:04d}"

    # Primary product summary for table compatibility
    first_item = args['items'][0]
    total_qty = sum(it.get('quantity', 1) for it in args['items'])
    summary_prod_name = first_item['product_name'] if len(args['items']) == 1 else f"{first_item['product_name']} + {len(args['items']) - 1} more"

    # 3. Insert into sales table
    cur.execute("""
        INSERT INTO sales (invoice_no, customer_name, customer_phone, product_name, quantity, subtotal, discount, tax_amount, total_amount, payment_method, payment_status, sale_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        invoice_no,
        args['customer_name'],
        args['customer_phone'],
        summary_prod_name,
        total_qty,
        args['subtotal'],
        args['discount'],
        args['tax_amount'],
        args['total_amount'],
        args['payment_method'],
        args['payment_status'],
        args['sale_date'],
        args['notes']
    ))
    sale_id = cur.lastrowid

    # 4. Insert items & reduce stock
    saved_items = []
    for item in args['items']:
        p_id = item.get('product_id')
        p_name = item.get('product_name', '').strip()
        req_qty = item.get('quantity', 1)

        # Find matching product if any
        prod = None
        if p_id:
            prod = cur.execute("SELECT id, name, stock_quantity FROM products WHERE id = ?", (p_id,)).fetchone()
        if not prod and p_name:
            prod = cur.execute("SELECT id, name, stock_quantity FROM products WHERE LOWER(name) = LOWER(?)", (p_name,)).fetchone()

        resolved_pid = prod['id'] if prod else p_id

        cur.execute("""
            INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, discount, tax_rate, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sale_id,
            resolved_pid,
            item['product_name'],
            item.get('sku', ''),
            req_qty,
            item['unit_price'],
            item['discount'],
            item.get('tax_rate', 18.0),
            item['total_price']
        ))
        item_id = cur.lastrowid
        item_copy = dict(item)
        item_copy['id'] = item_id
        item_copy['sale_id'] = sale_id
        saved_items.append(item_copy)

        # Deduct stock quantity in products and record movement
        if prod:
            prev_stk = prod['stock_quantity'] if prod['stock_quantity'] is not None else 0
            new_stk = max(0, prev_stk - req_qty)
            cur.execute("""
                UPDATE products
                SET stock_quantity = ?
                WHERE id = ?
            """, (new_stk, prod['id']))
            cur.execute("""
                INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
                VALUES (?, ?, 'Sale', ?, ?, ?, ?, ?)
            """, (prod['id'], prod['name'], req_qty, prev_stk, new_stk, invoice_no, f"Sale via invoice {invoice_no}"))

    # 5. Customer Record Upsert & Recalculate stats
    c_name = (args.get('customer_name') or '').strip()
    c_phone = (args.get('customer_phone') or '').strip()
    c_addr = (args.get('customer_address') or '').strip()
    c_notes = (args.get('customer_notes') or '').strip()
    c_gst = (args.get('customer_gst') or '').strip()

    is_paid = (args.get('payment_status') or 'Paid').lower() == 'paid'
    paid_delta = args['total_amount'] if is_paid else 0.0
    pending_delta = 0.0 if is_paid else args['total_amount']

    if c_name or c_phone:
        cust = None
        if c_phone:
            cust = cur.execute("SELECT id FROM customers WHERE phone = ?", (c_phone,)).fetchone()
        if not cust and c_name:
            cust = cur.execute("SELECT id FROM customers WHERE LOWER(name) = LOWER(?)", (c_name,)).fetchone()

        if cust:
            cur.execute("""
                UPDATE customers
                SET name = COALESCE(NULLIF(?, ''), name),
                    phone = COALESCE(NULLIF(?, ''), phone),
                    address = COALESCE(NULLIF(?, ''), address),
                    gst_number = COALESCE(NULLIF(?, ''), gst_number),
                    total_orders = total_orders + 1,
                    total_purchases = total_purchases + ?,
                    paid_amount = paid_amount + ?,
                    pending_amount = pending_amount + ?,
                    last_purchase_date = ?
                WHERE id = ?
            """, (c_name, c_phone, c_addr, c_gst, args['total_amount'], paid_delta, pending_delta, args['sale_date'], cust['id']))
        else:
            cur.execute("""
                INSERT INTO customers (name, phone, email, address, gst_number, notes, total_orders, total_purchases, paid_amount, pending_amount, last_purchase_date)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
            """, (c_name, c_phone, '', c_addr, c_gst, c_notes, args['total_amount'], paid_delta, pending_delta, args['sale_date']))

    conn.commit()

    # Retrieve complete created sale
    row = cur.execute("SELECT * FROM sales WHERE id = ?", (sale_id,)).fetchone()
    created_sale = dict(row)
    created_sale['items'] = saved_items

    print(json.dumps({
        'success': True,
        'sale': created_sale,
        'invoice_no': invoice_no,
        'message': f"Invoice {invoice_no} created successfully! Stock reduced automatically."
    }))
except Exception as e:
    conn.rollback()
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(400).json({ success: false, error: data.error || "Failed to record sale" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/sales error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Update existing sale details (customer, phone, payment, status, notes)
  app.put("/api/sales/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Sale ID" });
    }

    const { customer_name, customer_phone, payment_method, payment_status, sale_date, notes } = req.body || {};

    const payload = {
      id,
      customer_name: customer_name ? customer_name.trim() : "",
      customer_phone: customer_phone ? customer_phone.trim() : "",
      payment_method: payment_method || "Cash",
      payment_status: payment_status || "Paid",
      sale_date: sale_date ? sale_date.trim() : "",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        UPDATE sales
        SET customer_name = COALESCE(NULLIF(?, ''), customer_name),
            customer_phone = ?,
            payment_method = ?,
            payment_status = ?,
            sale_date = COALESCE(NULLIF(?, ''), sale_date),
            notes = ?
        WHERE id = ?
    """, (
        args['customer_name'],
        args['customer_phone'],
        args['payment_method'],
        args['payment_status'],
        args['sale_date'],
        args['notes'],
        args['id']
    ))
    conn.commit()

    if cur.rowcount == 0:
        print(json.dumps({'success': False, 'error': 'Sale record not found', 'not_found': True}))
    else:
        # Re-sync customer stats
        target_phone = args.get('customer_phone') or ''
        target_name = args.get('customer_name') or ''
        if target_phone or target_name:
            stats = cur.execute("""
                SELECT 
                    COUNT(*),
                    COALESCE(SUM(total_amount), 0.0),
                    COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
                    COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
                    MAX(sale_date)
                FROM sales
                WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
                   OR (LOWER(customer_name) = LOWER(?))
            """, (target_phone, target_name)).fetchone()
            if stats:
                cur.execute("""
                    UPDATE customers
                    SET total_orders = ?,
                        total_purchases = ?,
                        paid_amount = ?,
                        pending_amount = ?,
                        last_purchase_date = ?
                    WHERE (phone IS NOT NULL AND phone != '' AND phone = ?)
                       OR (LOWER(name) = LOWER(?))
                """, (stats[0], stats[1], stats[2], stats[3], stats[4], target_phone, target_name))
                conn.commit()

        row = cur.execute("SELECT * FROM sales WHERE id = ?", (args['id'],)).fetchone()
        updated_sale = dict(row)
        items = cur.execute("SELECT * FROM sale_items WHERE sale_id = ?", (args['id'],)).fetchall()
        updated_sale['items'] = [dict(it) for it in items]
        print(json.dumps({'success': True, 'sale': updated_sale, 'message': 'Sale record updated successfully.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const status = data.not_found ? 404 : 500;
        return res.status(status).json({ success: false, error: data.error || "Failed to update sale" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`PUT /api/sales/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete a sale, RESTORE product stock in SQLite, and remove items
  app.delete("/api/sales/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Sale ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

sale_id = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    sale_row = cur.execute("SELECT invoice_no, customer_phone, customer_name FROM sales WHERE id = ?", (sale_id,)).fetchone()
    if not sale_row:
        print(json.dumps({'success': False, 'error': 'Sale not found', 'not_found': True}))
        sys.exit(0)

    inv_num = sale_row['invoice_no'] or f"ID #{sale_id}"
    c_phone = sale_row['customer_phone'] or ''
    c_name = sale_row['customer_name'] or ''

    # 1. Fetch items to restore stock
    items = cur.execute("SELECT product_id, product_name, quantity FROM sale_items WHERE sale_id = ?", (sale_id,)).fetchall()
    for it in items:
        p_id = it['product_id']
        p_name = it['product_name']
        qty = it['quantity'] if it['quantity'] is not None else 1

        matched_p = None
        if p_id:
            matched_p = cur.execute("SELECT id, name, stock_quantity FROM products WHERE id = ?", (p_id,)).fetchone()
        elif p_name:
            matched_p = cur.execute("SELECT id, name, stock_quantity FROM products WHERE LOWER(name) = LOWER(?)", (p_name.strip(),)).fetchone()

        if matched_p:
            prev_stk = matched_p['stock_quantity'] if matched_p['stock_quantity'] is not None else 0
            new_stk = prev_stk + qty
            cur.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", (new_stk, matched_p['id']))
            cur.execute("""
                INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
                VALUES (?, ?, 'Sale Restored', ?, ?, ?, ?, ?)
            """, (matched_p['id'], matched_p['name'], qty, prev_stk, new_stk, inv_num, f"Invoice {inv_num} deleted — inventory restored"))
        else:
            if p_id:
                cur.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", (qty, p_id))
            elif p_name:
                cur.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE LOWER(name) = LOWER(?)", (qty, p_name.strip()))

    # 2. Delete sale items and sale record
    cur.execute("DELETE FROM sale_items WHERE sale_id = ?", (sale_id,))
    cur.execute("DELETE FROM sales WHERE id = ?", (sale_id,))
    conn.commit()

    # 3. Recalculate customer metrics after sale deletion
    if c_phone or c_name:
        stats = cur.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(total_amount), 0.0),
                COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
                COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
                MAX(sale_date)
            FROM sales
            WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
               OR (LOWER(customer_name) = LOWER(?))
        """, (c_phone, c_name)).fetchone()
        if stats:
            cur.execute("""
                UPDATE customers
                SET total_orders = ?,
                    total_purchases = ?,
                    paid_amount = ?,
                    pending_amount = ?,
                    last_purchase_date = ?
                WHERE (phone IS NOT NULL AND phone != '' AND phone = ?)
                   OR (LOWER(name) = LOWER(?))
            """, (stats[0], stats[1], stats[2], stats[3], stats[4], c_phone, c_name))
            conn.commit()

    print(json.dumps({
        'success': True,
        'message': f"Invoice {inv_num} deleted successfully. Product inventory quantities have been restored."
    }))
except Exception as e:
    conn.rollback()
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const status = data.not_found ? 404 : 500;
        return res.status(status).json({ success: false, error: data.error || "Failed to delete sale" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/sales/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Record payment / partial payment for an invoice/sale (Requirements 10 & 11)
  app.post("/api/sales/:id/payment", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Sale ID." });
    }
    const { amount, payment_method, notes } = req.body || {};
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: "Payment amount must be greater than ₹0." });
    }

    const payload = {
      id,
      amount: numAmount,
      payment_method: payment_method || "Cash",
      notes: notes ? String(notes).trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    sale = cur.execute("SELECT * FROM sales WHERE id = ?", (args['id'],)).fetchone()
    if not sale:
        print(json.dumps({'success': False, 'error': 'Sale invoice not found', 'not_found': True}))
        sys.exit(0)

    total_amt = float(sale['total_amount'] or 0.0)
    current_paid = float(sale['paid_amount'] or (total_amt if (sale['payment_status'] or '').lower() == 'paid' else 0.0))
    add_amt = float(args['amount'])
    new_paid = min(total_amt, round(current_paid + add_amt, 2))
    new_pending = max(0.0, round(total_amt - new_paid, 2))
    new_status = 'Paid' if new_pending <= 0.01 else 'Partially Paid'
    
    note_append = f"Payment ₹{add_amt} via {args['payment_method']}"
    if args['notes']:
        note_append += f" ({args['notes']})"
    old_notes = sale['notes'] or ''
    updated_notes = f"{old_notes} | {note_append}".strip(" |")

    cur.execute("""
        UPDATE sales
        SET paid_amount = ?,
            pending_amount = ?,
            payment_status = ?,
            payment_method = ?,
            notes = ?
        WHERE id = ?
    """, (new_paid, new_pending, new_status, args['payment_method'], updated_notes, args['id']))
    conn.commit()

    # Recalculate customer paid & pending amounts
    c_phone = sale['customer_phone'] or ''
    c_name = sale['customer_name'] or ''
    if c_phone or c_name:
        stats = cur.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(total_amount), 0.0),
                COALESCE(SUM(COALESCE(paid_amount, CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END)), 0.0),
                COALESCE(SUM(COALESCE(pending_amount, CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END)), 0.0),
                MAX(sale_date)
            FROM sales
            WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
               OR (LOWER(customer_name) = LOWER(?))
        """, (c_phone, c_name)).fetchone()
        if stats:
            cur.execute("""
                UPDATE customers
                SET paid_amount = ?,
                    pending_amount = ?
                WHERE (phone IS NOT NULL AND phone != '' AND phone = ?)
                   OR (LOWER(name) = LOWER(?))
            """, (stats[2], stats[3], c_phone, c_name))
            conn.commit()

    updated = cur.execute("SELECT * FROM sales WHERE id = ?", (args['id'],)).fetchone()
    print(json.dumps({
        'success': True,
        'sale': dict(updated),
        'message': f"Payment of ₹{add_amt} recorded. Invoice status: {new_status}."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      res.json(data);
    } catch (err: any) {
      console.error(`POST /api/sales/${id}/payment error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Mark invoice as fully paid (Requirement 11)
  app.post("/api/sales/:id/mark-paid", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Sale ID." });
    }
    const { payment_method } = req.body || {};

    const payload = {
      id,
      payment_method: payment_method || "Cash"
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    sale = cur.execute("SELECT * FROM sales WHERE id = ?", (args['id'],)).fetchone()
    if not sale:
        print(json.dumps({'success': False, 'error': 'Sale not found', 'not_found': True}))
        sys.exit(0)

    total_amt = float(sale['total_amount'] or 0.0)
    cur.execute("""
        UPDATE sales
        SET paid_amount = ?,
            pending_amount = 0.0,
            payment_status = 'Paid',
            payment_method = ?
        WHERE id = ?
    """, (total_amt, args['payment_method'], args['id']))
    conn.commit()

    # Recalculate customer balance
    c_phone = sale['customer_phone'] or ''
    c_name = sale['customer_name'] or ''
    if c_phone or c_name:
        stats = cur.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(total_amount), 0.0),
                COALESCE(SUM(COALESCE(paid_amount, CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END)), 0.0),
                COALESCE(SUM(COALESCE(pending_amount, CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END)), 0.0),
                MAX(sale_date)
            FROM sales
            WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
               OR (LOWER(customer_name) = LOWER(?))
        """, (c_phone, c_name)).fetchone()
        if stats:
            cur.execute("""
                UPDATE customers
                SET paid_amount = ?,
                    pending_amount = ?
                WHERE (phone IS NOT NULL AND phone != '' AND phone = ?)
                   OR (LOWER(name) = LOWER(?))
            """, (stats[2], stats[3], c_phone, c_name))
            conn.commit()

    updated = cur.execute("SELECT * FROM sales WHERE id = ?", (args['id'],)).fetchone()
    print(json.dumps({
        'success': True,
        'sale': dict(updated),
        'message': f"Invoice marked as Paid in full."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      res.json(data);
    } catch (err: any) {
      console.error(`POST /api/sales/${id}/mark-paid error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= PRODUCTS & INVENTORY API (Step 7) =================
  // GET: Fetch products with purchase & selling price, stock levels, and calculated status
  app.get("/api/products", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    rows = cur.execute("""
        SELECT id, name, category, sku, price, 
               COALESCE(mrp, price) as mrp,
               COALESCE(discount_percent, 0.0) as discount_percent,
               COALESCE(discount_amount, 0.0) as discount_amount,
               COALESCE(discount_type, 'percentage') as discount_type,
               COALESCE(purchase_price, ROUND(price * 0.65, 2)) as purchase_price,
               stock_quantity, min_stock_level,
               COALESCE(max_stock_level, 50) as max_stock_level,
               ROUND(stock_quantity * COALESCE(purchase_price, ROUND(price * 0.65, 2)), 2) as stock_value,
               COALESCE(supplier, '') as supplier,
               COALESCE(brand, '') as brand,
               CASE 
                   WHEN stock_quantity <= 0 THEN 'Out of Stock'
                   WHEN stock_quantity <= min_stock_level THEN 'Low Stock'
                   WHEN max_stock_level IS NOT NULL AND max_stock_level > 0 AND stock_quantity > max_stock_level THEN 'Overstock'
                   ELSE 'In Stock'
               END as status,
               created_at
        FROM products
        ORDER BY name ASC
    """).fetchall()
    products = [dict(r) for r in rows]
    print(json.dumps({'success': True, 'products': products}))
except Exception as e:
    print(json.dumps({'success': False, 'products': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/products error:", err);
      res.status(500).json({ success: false, products: [], error: err.message });
    }
  });

  // POST: Add new product to SQLite & log initial stock movement
  app.post("/api/products", async (req, res) => {
    const { 
      name, 
      category, 
      sku, 
      price, 
      mrp, 
      discount_percent, 
      discount_amount, 
      discount_type, 
      purchase_price, 
      stock_quantity, 
      min_stock_level, 
      max_stock_level,
      supplier,
      brand
    } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Product Name is required." });
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, error: "Selling Price cannot be negative." });
    }

    // MRP / Original Price
    let numMrp = parseFloat(mrp);
    if (!isNaN(numMrp) && numMrp > 0 && numPrice > numMrp) {
      return res.status(400).json({ success: false, error: "Selling Price cannot be greater than MRP." });
    }
    // Safely handle missing or zero MRP
    if (isNaN(numMrp) || numMrp <= 0) {
      numMrp = numPrice;
    }

    // Auto-calculate discount amount & percentage
    // Formula: Discount Amount = MRP - Selling Price, Discount % = ((MRP - Selling Price) / MRP) * 100
    const calcDiscountAmount = numMrp > numPrice ? Math.round((numMrp - numPrice) * 100) / 100 : 0;
    const calcDiscountPercent =
      numMrp > numPrice && numMrp > 0 ? Math.round(((numMrp - numPrice) / numMrp) * 1000) / 10 : 0;
    const dType = discount_type === "fixed" ? "fixed" : "percentage";

    const numCost = parseFloat(purchase_price);
    if (!isNaN(numCost) && numCost < 0) {
      return res.status(400).json({ success: false, error: "Purchase Price cannot be negative." });
    }
    const validCost = isNaN(numCost) || numCost < 0 ? 0.0 : numCost;

    const numStock = parseInt(stock_quantity, 10);
    if (!isNaN(numStock) && numStock < 0) {
      return res.status(400).json({ success: false, error: "Starting Stock Quantity cannot be negative." });
    }
    const validStock = isNaN(numStock) || numStock < 0 ? 0 : numStock;

    const numMin = parseInt(min_stock_level, 10);
    if (!isNaN(numMin) && numMin < 0) {
      return res.status(400).json({ success: false, error: "Minimum Stock Level cannot be negative." });
    }
    const validMin = isNaN(numMin) || numMin < 0 ? 5 : numMin;

    const numMax = parseInt(max_stock_level, 10);
    const validMax = isNaN(numMax) || numMax < 0 ? Math.max(50, validMin * 5) : numMax;

    const autoSku = sku && sku.trim() ? sku.trim().toUpperCase() : `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      name: name.trim(),
      category: category && category.trim() ? category.trim() : "General",
      sku: autoSku,
      price: numPrice,
      mrp: numMrp,
      discount_amount: calcDiscountAmount,
      discount_percent: calcDiscountPercent,
      discount_type: dType,
      purchase_price: validCost,
      stock_quantity: validStock,
      min_stock_level: validMin,
      max_stock_level: validMax,
      supplier: supplier && supplier.trim() ? supplier.trim() : "",
      brand: brand && brand.trim() ? brand.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # Check for duplicate SKU
    if args.get('sku'):
        dup = cur.execute("SELECT id, name FROM products WHERE LOWER(sku) = LOWER(?)", (args['sku'],)).fetchone()
        if dup:
            print(json.dumps({'success': False, 'error': f"A product with SKU '{args['sku']}' already exists ({dup['name']})."}))
            sys.exit(0)

    cur.execute("""
        INSERT INTO products (name, category, sku, price, mrp, discount_amount, discount_percent, discount_type, purchase_price, stock_quantity, min_stock_level, max_stock_level, supplier, brand)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        args['name'],
        args['category'],
        args['sku'],
        args['price'],
        args['mrp'],
        args['discount_amount'],
        args['discount_percent'],
        args['discount_type'],
        args['purchase_price'],
        args['stock_quantity'],
        args['min_stock_level'],
        args['max_stock_level'],
        args['supplier'],
        args.get('brand', '')
    ))
    conn.commit()
    new_id = cur.lastrowid

    # If initial stock > 0, log in stock_movements
    if args['stock_quantity'] > 0:
        cur.execute("""
            INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
            VALUES (?, ?, 'Stock Added', ?, 0, ?, 'NEW-PRODUCT', 'Initial inventory setup')
        """, (new_id, args['name'], args['stock_quantity'], args['stock_quantity']))
        conn.commit()

    row = cur.execute("""
        SELECT id, name, category, sku, price, 
               COALESCE(mrp, price) as mrp,
               COALESCE(discount_percent, 0.0) as discount_percent,
               COALESCE(discount_amount, 0.0) as discount_amount,
               COALESCE(discount_type, 'percentage') as discount_type,
               purchase_price, stock_quantity, min_stock_level,
               COALESCE(max_stock_level, 50) as max_stock_level,
               ROUND(stock_quantity * purchase_price, 2) as stock_value,
               COALESCE(supplier, '') as supplier,
               COALESCE(brand, '') as brand,
               CASE 
                   WHEN stock_quantity <= 0 THEN 'Out of Stock'
                   WHEN stock_quantity <= min_stock_level THEN 'Low Stock'
                   WHEN max_stock_level IS NOT NULL AND max_stock_level > 0 AND stock_quantity > max_stock_level THEN 'Overstock'
                   ELSE 'In Stock'
               END as status,
               created_at
        FROM products WHERE id = ?
    """, (new_id,)).fetchone()
    print(json.dumps({'success': True, 'product': dict(row), 'message': f"Product '{args['name']}' added to inventory."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(500).json({ success: false, error: data.error || "Failed to add product" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/products error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Update an existing product & track stock adjustment if quantity changed
  app.put("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Product ID." });
    }

    const { 
      name, 
      category, 
      sku, 
      price, 
      mrp, 
      discount_percent, 
      discount_amount, 
      discount_type, 
      purchase_price, 
      stock_quantity, 
      min_stock_level, 
      max_stock_level, 
      supplier,
      brand
    } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Product Name is required." });
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, error: "Selling Price cannot be negative." });
    }

    let numMrp = parseFloat(mrp);
    if (!isNaN(numMrp) && numMrp > 0 && numPrice > numMrp) {
      return res.status(400).json({ success: false, error: "Selling Price cannot be greater than MRP." });
    }
    // Safely handle missing or zero MRP
    if (isNaN(numMrp) || numMrp <= 0) {
      numMrp = numPrice;
    }

    let calcDiscountAmount = 0;
    let calcDiscountPercent = 0;
    const dType = discount_type === "fixed" ? "fixed" : "percentage";

    if (numMrp > numPrice && numMrp > 0) {
      // Calculate Discount Amount = MRP - Selling Price
      // Calculate Discount Percentage = ((MRP - Selling Price) / MRP) * 100
      calcDiscountAmount = Math.round((numMrp - numPrice) * 100) / 100;
      calcDiscountPercent = Math.round(((numMrp - numPrice) / numMrp) * 1000) / 10;
    } else if (discount_percent && parseFloat(discount_percent) > 0) {
      calcDiscountPercent = Math.min(100, Math.max(0, parseFloat(discount_percent)));
      calcDiscountAmount = Math.round((numMrp * (calcDiscountPercent / 100)) * 100) / 100;
    } else if (discount_amount && parseFloat(discount_amount) > 0) {
      calcDiscountAmount = Math.max(0, parseFloat(discount_amount));
      calcDiscountPercent = numMrp > 0 ? Math.round((calcDiscountAmount / numMrp) * 1000) / 10 : 0;
    }

    const numCost = parseFloat(purchase_price);
    if (!isNaN(numCost) && numCost < 0) {
      return res.status(400).json({ success: false, error: "Purchase Price cannot be negative." });
    }
    const validCost = isNaN(numCost) || numCost < 0 ? 0.0 : numCost;

    const numStock = parseInt(stock_quantity, 10);
    if (!isNaN(numStock) && numStock < 0) {
      return res.status(400).json({ success: false, error: "Stock Quantity cannot be negative." });
    }
    const validStock = isNaN(numStock) || numStock < 0 ? 0 : numStock;

    const numMin = parseInt(min_stock_level, 10);
    if (!isNaN(numMin) && numMin < 0) {
      return res.status(400).json({ success: false, error: "Minimum Stock Level cannot be negative." });
    }
    const validMin = isNaN(numMin) || numMin < 0 ? 5 : numMin;

    const numMax = parseInt(max_stock_level, 10);
    const validMax = isNaN(numMax) || numMax < 0 ? Math.max(50, validMin * 5) : numMax;

    const cleanSku = sku ? sku.trim().toUpperCase() : "";

    const payload = {
      id,
      name: name.trim(),
      category: category && category.trim() ? category.trim() : "General",
      sku: cleanSku,
      price: numPrice,
      mrp: numMrp,
      discount_amount: calcDiscountAmount,
      discount_percent: calcDiscountPercent,
      discount_type: dType,
      purchase_price: validCost,
      stock_quantity: validStock,
      min_stock_level: validMin,
      max_stock_level: validMax,
      supplier: supplier && supplier.trim() ? supplier.trim() : "",
      brand: brand && brand.trim() ? brand.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    old_row = cur.execute("SELECT id, name, stock_quantity FROM products WHERE id = ?", (args['id'],)).fetchone()
    if not old_row:
        print(json.dumps({'success': False, 'error': 'Product not found', 'not_found': True}))
        sys.exit(0)

    # Check for duplicate SKU excluding self
    if args.get('sku'):
        dup = cur.execute("SELECT id, name FROM products WHERE LOWER(sku) = LOWER(?) AND id != ?", (args['sku'], args['id'])).fetchone()
        if dup:
            print(json.dumps({'success': False, 'error': f"A product with SKU '{args['sku']}' already exists ({dup['name']})."}))
            sys.exit(0)

    prev_stk = old_row['stock_quantity'] if old_row['stock_quantity'] is not None else 0
    new_stk = args['stock_quantity']

    cur.execute("""
        UPDATE products
        SET name = ?,
            category = ?,
            sku = ?,
            price = ?,
            mrp = ?,
            discount_amount = ?,
            discount_percent = ?,
            discount_type = ?,
            purchase_price = ?,
            stock_quantity = ?,
            min_stock_level = ?,
            max_stock_level = ?,
            supplier = ?,
            brand = ?
        WHERE id = ?
    """, (
        args['name'],
        args['category'],
        args['sku'],
        args['price'],
        args['mrp'],
        args['discount_amount'],
        args['discount_percent'],
        args['discount_type'],
        args['purchase_price'],
        new_stk,
        args['min_stock_level'],
        args['max_stock_level'],
        args['supplier'],
        args.get('brand', ''),
        args['id']
    ))
    conn.commit()

    # If stock quantity changed, log adjustment in stock_movements
    if prev_stk != new_stk:
        diff = new_stk - prev_stk
        m_type = 'Stock Added' if diff > 0 else 'Adjustment'
        cur.execute("""
            INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'MANUAL-EDIT', ?)
        """, (args['id'], args['name'], m_type, abs(diff), prev_stk, new_stk, f"Inventory updated from {prev_stk} to {new_stk} units"))
        conn.commit()

    updated = cur.execute("""
        SELECT id, name, category, sku, price, 
               COALESCE(mrp, price) as mrp,
               COALESCE(discount_percent, 0.0) as discount_percent,
               COALESCE(discount_amount, 0.0) as discount_amount,
               COALESCE(discount_type, 'percentage') as discount_type,
               purchase_price, stock_quantity, min_stock_level,
               COALESCE(max_stock_level, 50) as max_stock_level,
               ROUND(stock_quantity * purchase_price, 2) as stock_value,
               COALESCE(supplier, '') as supplier,
               COALESCE(brand, '') as brand,
               CASE 
                   WHEN stock_quantity <= 0 THEN 'Out of Stock'
                   WHEN stock_quantity <= min_stock_level THEN 'Low Stock'
                   WHEN max_stock_level IS NOT NULL AND max_stock_level > 0 AND stock_quantity > max_stock_level THEN 'Overstock'
                   ELSE 'In Stock'
               END as status,
               created_at
        FROM products WHERE id = ?
    """, (args['id'],)).fetchone()

    print(json.dumps({'success': True, 'product': dict(updated), 'message': f"Product '{args['name']}' updated successfully."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const status = data.not_found ? 404 : 400;
        return res.status(status).json({ success: false, error: data.error || "Failed to update product" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`PUT /api/products/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete product from SQLite
  app.delete("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Product ID." });
    }

    const pythonScript = `
import sqlite3, json, sys, os

prod_id = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT name FROM products WHERE id = ?", (prod_id,)).fetchone()
    if not row:
        print(json.dumps({'success': False, 'error': 'Product not found', 'not_found': True}))
        sys.exit(0)

    p_name = row['name']
    cur.execute("DELETE FROM products WHERE id = ?", (prod_id,))
    conn.commit()
    print(json.dumps({'success': True, 'message': f"Product '{p_name}' deleted from inventory."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const status = data.not_found ? 404 : 500;
        return res.status(status).json({ success: false, error: data.error || "Failed to delete product" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/products/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Quick Restock / Stock Adjustment for a product (Requirement 8)
  app.post("/api/products/:id/adjust", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Product ID." });
    }

    const { action_type, quantity, notes, reference } = req.body || {};

    // Validate reason requirement (Requirement 8: Require a reason for every manual stock adjustment)
    if (!notes || !notes.trim()) {
      return res.status(400).json({ success: false, error: "A reason is required for every manual stock adjustment." });
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({ success: false, error: "Quantity must be a valid positive number." });
    }
    if ((action_type === "add" || action_type === "increase" || action_type === "decrease" || action_type === "subtract") && numQty <= 0) {
      return res.status(400).json({ success: false, error: "Quantity must be greater than 0." });
    }

    const normAction = action_type === "decrease" || action_type === "subtract"
      ? "decrease"
      : action_type === "set"
      ? "set"
      : "add";

    const payload = {
      id,
      action_type: normAction,
      quantity: numQty,
      notes: notes.trim(),
      reference: reference && reference.trim() ? reference.trim() : "ADJUSTMENT"
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT id, name, stock_quantity FROM products WHERE id = ?", (args['id'],)).fetchone()
    if not row:
        print(json.dumps({'success': False, 'error': 'Product not found', 'not_found': True}))
        sys.exit(0)

    p_name = row['name']
    prev_stk = row['stock_quantity'] if row['stock_quantity'] is not None else 0
    qty = args['quantity']

    if args['action_type'] == 'add':
        new_stk = prev_stk + qty
        move_type = 'Stock Added'
        chg_qty = qty
    elif args['action_type'] == 'decrease':
        if prev_stk < qty:
            print(json.dumps({
                'success': False,
                'error': f"Cannot decrease stock by {qty}. Current stock is only {prev_stk} units."
            }))
            sys.exit(0)
        new_stk = prev_stk - qty
        move_type = 'Adjustment'
        chg_qty = -qty
    else: # set
        new_stk = max(0, qty)
        move_type = 'Adjustment'
        chg_qty = new_stk - prev_stk

    cur.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", (new_stk, args['id']))
    cur.execute("""
        INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (args['id'], p_name, move_type, abs(chg_qty), prev_stk, new_stk, args['reference'], args['notes']))
    conn.commit()

    updated = cur.execute("""
        SELECT id, name, category, sku, price, purchase_price, stock_quantity, min_stock_level,
               COALESCE(supplier, '') as supplier,
               CASE 
                   WHEN stock_quantity <= 0 THEN 'Out of Stock'
                   WHEN stock_quantity <= min_stock_level THEN 'Low Stock'
                   ELSE 'In Stock'
               END as status,
               created_at
        FROM products WHERE id = ?
    """, (args['id'],)).fetchone()

    print(json.dumps({
        'success': True,
        'product': dict(updated),
        'message': f"Stock updated for '{p_name}': now {new_stk} units."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const status = data.not_found ? 404 : 500;
        return res.status(status).json({ success: false, error: data.error || "Failed to adjust stock" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`POST /api/products/${id}/adjust error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET: Stock Movement History (Requirement 9)
  app.get("/api/stock-movements", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    rows = cur.execute("""
        SELECT id, product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes, created_at
        FROM stock_movements
        ORDER BY created_at DESC, id DESC
        LIMIT 100
    """).fetchall()
    movements = [dict(r) for r in rows]
    print(json.dumps({'success': True, 'movements': movements}))
except Exception as e:
    print(json.dumps({'success': False, 'movements': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/stock-movements error:", err);
      res.status(500).json({ success: false, movements: [], error: err.message });
    }
  });

  // ================= EXPENSES CRUD API =================
  // GET: Fetch all expenses from SQLite with summary metrics & chart aggregation
  app.get("/api/expenses", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, datetime, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    rows = cur.execute("""
        SELECT id,
               COALESCE(NULLIF(title, ''), description, 'Expense') as title,
               category,
               amount,
               expense_date,
               COALESCE(payment_method, 'UPI') as payment_method,
               notes,
               description,
               created_at
        FROM expenses
        ORDER BY expense_date DESC, id DESC
    """).fetchall()

    expenses = [dict(r) for r in rows]

    today_str = datetime.date.today().isoformat()
    current_month_prefix = today_str[:7] # YYYY-MM

    total_expenses = sum(float(e['amount']) for e in expenses if e.get('amount') is not None)
    today_expenses = sum(float(e['amount']) for e in expenses if str(e.get('expense_date', '')).startswith(today_str))
    monthly_expenses = sum(float(e['amount']) for e in expenses if str(e.get('expense_date', '')).startswith(current_month_prefix))

    # Category summary
    cat_map = {}
    for e in expenses:
        cat = e.get('category') or 'Other'
        amt = float(e.get('amount') or 0.0)
        if cat not in cat_map:
            cat_map[cat] = {'category': cat, 'amount': 0.0, 'count': 0}
        cat_map[cat]['amount'] += amt
        cat_map[cat]['count'] += 1

    category_summary = sorted(list(cat_map.values()), key=lambda x: x['amount'], reverse=True)

    # 7-day daily summary for expense chart
    daily_summary = []
    for i in range(6, -1, -1):
        day = datetime.date.today() - datetime.timedelta(days=i)
        d_str = day.isoformat()
        lbl = day.strftime('%b %d')
        day_amt = sum(float(e['amount']) for e in expenses if str(e.get('expense_date', '')) == d_str)
        daily_summary.append({
            'date': d_str,
            'label': lbl,
            'amount': round(day_amt, 2)
        })

    print(json.dumps({
        'success': True,
        'expenses': expenses,
        'total_expenses': round(total_expenses, 2),
        'today_expenses': round(today_expenses, 2),
        'monthly_expenses': round(monthly_expenses, 2),
        'category_summary': category_summary,
        'daily_summary': daily_summary
    }))
except Exception as e:
    print(json.dumps({'success': False, 'expenses': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/expenses error:", err);
      res.status(500).json({ success: false, expenses: [], error: err.message });
    }
  });

  // POST: Add new expense to SQLite database
  app.post("/api/expenses", async (req, res) => {
    const { title, description, category, amount, expense_date, payment_method, notes } = req.body || {};
    const finalTitle = (title && title.trim()) || (description && description.trim());
    if (!finalTitle) {
      return res.status(400).json({ success: false, error: "Expense Title is required." });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be a valid positive number greater than 0." });
    }

    const validCategories = [
      "Rent",
      "Salary",
      "Electricity",
      "Internet",
      "Transport",
      "Stock Purchase",
      "Maintenance",
      "Marketing",
      "Other"
    ];

    const finalCategory = category && validCategories.includes(category) ? category : (category || "Other");
    const finalDate = expense_date && expense_date.trim() ? expense_date.trim() : new Date().toISOString().split("T")[0];
    const finalMethod = payment_method && payment_method.trim() ? payment_method.trim() : "UPI";
    const finalNotes = notes ? notes.trim() : "";

    const payload = {
      title: finalTitle,
      category: finalCategory,
      amount: numAmount,
      expense_date: finalDate,
      payment_method: finalMethod,
      notes: finalNotes,
      description: finalTitle
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        INSERT INTO expenses (title, category, amount, expense_date, payment_method, notes, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        args['title'],
        args['category'],
        args['amount'],
        args['expense_date'],
        args['payment_method'],
        args['notes'],
        args['description']
    ))
    conn.commit()
    new_id = cur.lastrowid
    row = cur.execute("SELECT * FROM expenses WHERE id = ?", (new_id,)).fetchone()
    expense_data = dict(row)
    print(json.dumps({
        'success': True,
        'expense': expense_data,
        'message': f"Expense '{args['title']}' recorded successfully."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(500).json({ success: false, error: data.error || "Failed to save expense to database" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/expenses error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Update an existing expense in SQLite database
  app.put("/api/expenses/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid expense ID" });
    }

    const { title, description, category, amount, expense_date, payment_method, notes } = req.body || {};
    const finalTitle = (title && title.trim()) || (description && description.trim());
    if (!finalTitle) {
      return res.status(400).json({ success: false, error: "Expense Title is required." });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be a valid positive number greater than 0." });
    }

    const validCategories = [
      "Rent",
      "Salary",
      "Electricity",
      "Internet",
      "Transport",
      "Stock Purchase",
      "Maintenance",
      "Marketing",
      "Other"
    ];

    const finalCategory = category && validCategories.includes(category) ? category : (category || "Other");
    const finalDate = expense_date && expense_date.trim() ? expense_date.trim() : new Date().toISOString().split("T")[0];
    const finalMethod = payment_method && payment_method.trim() ? payment_method.trim() : "UPI";
    const finalNotes = notes ? notes.trim() : "";

    const payload = {
      id,
      title: finalTitle,
      category: finalCategory,
      amount: numAmount,
      expense_date: finalDate,
      payment_method: finalMethod,
      notes: finalNotes,
      description: finalTitle
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        UPDATE expenses
        SET title = ?, category = ?, amount = ?, expense_date = ?, payment_method = ?, notes = ?, description = ?
        WHERE id = ?
    """, (
        args['title'],
        args['category'],
        args['amount'],
        args['expense_date'],
        args['payment_method'],
        args['notes'],
        args['description'],
        args['id']
    ))
    conn.commit()

    if cur.rowcount == 0:
        print(json.dumps({'success': False, 'error': 'Expense not found in database', 'not_found': True}))
    else:
        row = cur.execute("SELECT * FROM expenses WHERE id = ?", (args['id'],)).fetchone()
        updated = dict(row)
        print(json.dumps({
            'success': True,
            'expense': updated,
            'message': f"Expense '{args['title']}' updated successfully."
        }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const statusCode = data.not_found ? 404 : 500;
        return res.status(statusCode).json({ success: false, error: data.error || "Failed to update expense" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`PUT /api/expenses/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete an expense permanently from SQLite database
  app.delete("/api/expenses/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid expense ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

exp_id = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT COALESCE(NULLIF(title, ''), description, 'Expense') as title FROM expenses WHERE id = ?", (exp_id,)).fetchone()
    exp_title = row['title'] if row else f"ID #{exp_id}"
    cur.execute("DELETE FROM expenses WHERE id = ?", (exp_id,))
    conn.commit()
    if cur.rowcount == 0:
        print(json.dumps({'success': False, 'error': 'Expense not found in database', 'not_found': True}))
    else:
        print(json.dumps({'success': True, 'message': f"Expense '{exp_title}' deleted permanently."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const statusCode = data.not_found ? 404 : 500;
        return res.status(statusCode).json({ success: false, error: data.error || "Failed to delete expense" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/expenses/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // ================= CUSTOMERS CRUD & TRANSACTIONS API =================
  // GET: Fetch all customers with updated statistics
  app.get("/api/customers", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # 1. Update customer statistics dynamically from sales
    cur.execute("SELECT id, name, phone FROM customers")
    customers_list = cur.fetchall()
    for c in customers_list:
        cid = c['id']
        cphone = c['phone'] or ''
        cname = c['name'] or ''
        stats = cur.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(total_amount), 0.0),
                COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
                COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
                MAX(sale_date)
            FROM sales
            WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
               OR (LOWER(customer_name) = LOWER(?))
        """, (cphone, cname)).fetchone()

        if stats and stats[0] > 0:
            cur.execute("""
                UPDATE customers
                SET total_orders = ?,
                    total_purchases = ?,
                    paid_amount = ?,
                    pending_amount = ?,
                    last_purchase_date = ?
                WHERE id = ?
            """, (stats[0], stats[1], stats[2], stats[3], stats[4], cid))
    conn.commit()

    # 2. Retrieve all customers
    rows = cur.execute("""
        SELECT id, name, phone, email, address, gst_number, notes,
               total_orders, total_purchases, paid_amount, pending_amount,
               last_purchase_date, created_at
        FROM customers
        ORDER BY total_purchases DESC, id DESC
    """).fetchall()

    customers = []
    total_purchases_sum = 0.0
    total_paid_sum = 0.0
    total_pending_sum = 0.0
    customers_with_pending = 0

    for r in rows:
        d = dict(r)
        d['total_orders'] = int(d.get('total_orders') or 0)
        d['total_purchases'] = round(float(d.get('total_purchases') or 0.0), 2)
        d['paid_amount'] = round(float(d.get('paid_amount') or 0.0), 2)
        d['pending_amount'] = round(float(d.get('pending_amount') or 0.0), 2)
        if not d.get('email'): d['email'] = ''
        if not d.get('address'): d['address'] = ''
        if not d.get('gst_number'): d['gst_number'] = ''
        if not d.get('notes'): d['notes'] = ''
        if not d.get('last_purchase_date'): d['last_purchase_date'] = ''
        
        total_purchases_sum += d['total_purchases']
        total_paid_sum += d['paid_amount']
        total_pending_sum += d['pending_amount']
        if d['pending_amount'] > 0:
            customers_with_pending += 1

        customers.append(d)

    summary = {
        'total_customers': len(customers),
        'total_purchases': round(total_purchases_sum, 2),
        'total_paid': round(total_paid_sum, 2),
        'total_pending': round(total_pending_sum, 2),
        'customers_with_pending': customers_with_pending
    }

    print(json.dumps({'success': True, 'customers': customers, 'summary': summary}))
except Exception as e:
    print(json.dumps({'success': False, 'customers': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/customers error:", err);
      res.status(500).json({ success: false, customers: [], error: err.message });
    }
  });

  // GET: Customer details by ID
  app.get("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid customer ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

cid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT * FROM customers WHERE id = ?", (cid,)).fetchone()
    if not row:
        print(json.dumps({'success': False, 'error': 'Customer not found', 'not_found': True}))
    else:
        cust = dict(row)
        print(json.dumps({'success': True, 'customer': cust}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET: Customer Transaction / Invoices History (Requirement 9)
  app.get("/api/customers/:id/transactions", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid customer ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

cid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    c_row = cur.execute("SELECT * FROM customers WHERE id = ?", (cid,)).fetchone()
    if not c_row:
        print(json.dumps({'success': False, 'error': 'Customer not found', 'not_found': True}))
        sys.exit(0)

    cust = dict(c_row)
    c_phone = cust.get('phone') or ''
    c_name = cust.get('name') or ''

    # Fetch all sales for this customer
    sales_rows = cur.execute("""
        SELECT * FROM sales
        WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
           OR (LOWER(customer_name) = LOWER(?))
        ORDER BY sale_date DESC, id DESC
    """, (c_phone, c_name)).fetchall()

    transactions = []
    tot_amount = 0.0
    tot_paid = 0.0
    tot_pending = 0.0

    for s in sales_rows:
        s_dict = dict(s)
        s_id = s_dict['id']
        items = cur.execute("SELECT * FROM sale_items WHERE sale_id = ?", (s_id,)).fetchall()
        s_dict['items'] = [dict(it) for it in items]
        
        amt = float(s_dict.get('total_amount') or 0.0)
        tot_amount += amt
        if (s_dict.get('payment_status') or 'Paid').lower() == 'paid':
            tot_paid += amt
        else:
            tot_pending += amt

        transactions.append(s_dict)

    summary = {
        'total_orders': len(transactions),
        'total_purchases': round(tot_amount, 2),
        'paid_amount': round(tot_paid, 2),
        'pending_amount': round(tot_pending, 2)
    }

    print(json.dumps({
        'success': True,
        'customer': cust,
        'transactions': transactions,
        'summary': summary
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Add new customer (Requirement 2 & 4)
  app.post("/api/customers", async (req, res) => {
    const { name, phone, email, address, gst_number, notes } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Customer Name is required." });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: "Customer Mobile Number is required." });
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : "",
      address: address ? address.trim() : "",
      gst_number: gst_number ? gst_number.trim() : "",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # Check if duplicate phone exists
    existing = cur.execute("SELECT id, name FROM customers WHERE phone = ?", (args['phone'],)).fetchone()
    if existing:
        print(json.dumps({
            'success': False,
            'error': f"A customer named '{existing['name']}' already exists with phone '{args['phone']}'."
        }))
        sys.exit(0)

    # Check if any sales already exist for this phone or name to pre-link
    stats = cur.execute("""
        SELECT 
            COUNT(*),
            COALESCE(SUM(total_amount), 0.0),
            COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
            MAX(sale_date)
        FROM sales
        WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
           OR (LOWER(customer_name) = LOWER(?))
    """, (args['phone'], args['name'])).fetchone()

    t_orders = stats[0] if stats else 0
    t_purchases = stats[1] if stats else 0.0
    p_paid = stats[2] if stats else 0.0
    p_pending = stats[3] if stats else 0.0
    l_date = stats[4] if (stats and stats[4]) else None

    cur.execute("""
        INSERT INTO customers (name, phone, email, address, gst_number, notes, total_orders, total_purchases, paid_amount, pending_amount, last_purchase_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        args['name'],
        args['phone'],
        args['email'],
        args['address'],
        args['gst_number'],
        args['notes'],
        t_orders,
        t_purchases,
        p_paid,
        p_pending,
        l_date
    ))
    conn.commit()
    new_id = cur.lastrowid
    row = cur.execute("SELECT * FROM customers WHERE id = ?", (new_id,)).fetchone()
    created = dict(row)
    print(json.dumps({
        'success': True,
        'customer': created,
        'message': f"Customer '{args['name']}' added successfully."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(400).json({ success: false, error: data.error || "Failed to add customer" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/customers error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Update customer details (Requirement 4)
  app.put("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid customer ID" });
    }

    const { name, phone, email, address, gst_number, notes } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Customer Name is required." });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: "Customer Mobile Number is required." });
    }

    const payload = {
      id,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : "",
      address: address ? address.trim() : "",
      gst_number: gst_number ? gst_number.trim() : "",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    old_row = cur.execute("SELECT * FROM customers WHERE id = ?", (args['id'],)).fetchone()
    if not old_row:
        print(json.dumps({'success': False, 'error': 'Customer not found', 'not_found': True}))
        sys.exit(0)

    old_phone = old_row['phone'] or ''
    old_name = old_row['name'] or ''

    # Check if duplicate phone exists with another customer
    dup = cur.execute("SELECT id, name FROM customers WHERE phone = ? AND id != ?", (args['phone'], args['id'])).fetchone()
    if dup:
        print(json.dumps({
            'success': False,
            'error': f"Another customer '{dup['name']}' already uses phone number '{args['phone']}'."
        }))
        sys.exit(0)

    cur.execute("""
        UPDATE customers
        SET name = ?,
            phone = ?,
            email = ?,
            address = ?,
            gst_number = ?,
            notes = ?
        WHERE id = ?
    """, (
        args['name'],
        args['phone'],
        args['email'],
        args['address'],
        args['gst_number'],
        args['notes'],
        args['id']
    ))

    # Recalculate stats with new phone/name
    stats = cur.execute("""
        SELECT 
            COUNT(*),
            COALESCE(SUM(total_amount), 0.0),
            COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
            COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
            MAX(sale_date)
        FROM sales
        WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
           OR (LOWER(customer_name) = LOWER(?))
    """, (args['phone'], args['name'])).fetchone()

    if stats:
        cur.execute("""
            UPDATE customers
            SET total_orders = ?,
                total_purchases = ?,
                paid_amount = ?,
                pending_amount = ?,
                last_purchase_date = ?
            WHERE id = ?
        """, (stats[0], stats[1], stats[2], stats[3], stats[4], args['id']))

    conn.commit()
    updated_row = cur.execute("SELECT * FROM customers WHERE id = ?", (args['id'],)).fetchone()
    print(json.dumps({
        'success': True,
        'customer': dict(updated_row),
        'message': f"Customer '{args['name']}' updated successfully."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const code = data.not_found ? 404 : 400;
        return res.status(code).json({ success: false, error: data.error || "Failed to update customer" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`PUT /api/customers/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete customer permanently (Requirement 4 & 10)
  app.delete("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid customer ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

cid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    c_row = cur.execute("SELECT name FROM customers WHERE id = ?", (cid,)).fetchone()
    if not c_row:
        print(json.dumps({'success': False, 'error': 'Customer not found', 'not_found': True}))
        sys.exit(0)

    c_name = c_row['name']
    cur.execute("DELETE FROM customers WHERE id = ?", (cid,))
    conn.commit()

    print(json.dumps({
        'success': True,
        'message': f"Customer '{c_name}' removed from directory."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/customers/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Record payment for a customer invoice (Requirement 8 & 9)
  app.post("/api/customers/:id/pay-invoice", async (req, res) => {
    const customerId = parseInt(req.params.id, 10);
    const { sale_id, payment_method } = req.body || {};

    if (isNaN(customerId) || !sale_id) {
      return res.status(400).json({ success: false, error: "Invalid customer or sale ID" });
    }

    const payload = {
      customer_id: customerId,
      sale_id: parseInt(sale_id, 10),
      payment_method: payment_method || "UPI"
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # Mark sale as Paid
    cur.execute("""
        UPDATE sales
        SET payment_status = 'Paid',
            payment_method = ?
        WHERE id = ?
    """, (args['payment_method'], args['sale_id']))

    # Re-sync customer stats
    c_row = cur.execute("SELECT id, name, phone FROM customers WHERE id = ?", (args['customer_id'],)).fetchone()
    if c_row:
        cphone = c_row['phone'] or ''
        cname = c_row['name'] or ''
        stats = cur.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(total_amount), 0.0),
                COALESCE(SUM(CASE WHEN LOWER(payment_status) = 'paid' THEN total_amount ELSE 0 END), 0.0),
                COALESCE(SUM(CASE WHEN LOWER(payment_status) != 'paid' THEN total_amount ELSE 0 END), 0.0),
                MAX(sale_date)
            FROM sales
            WHERE (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = ?)
               OR (LOWER(customer_name) = LOWER(?))
        """, (cphone, cname)).fetchone()

        if stats:
            cur.execute("""
                UPDATE customers
                SET total_orders = ?,
                    total_purchases = ?,
                    paid_amount = ?,
                    pending_amount = ?,
                    last_purchase_date = ?
                WHERE id = ?
            """, (stats[0], stats[1], stats[2], stats[3], stats[4], args['customer_id']))

    conn.commit()
    print(json.dumps({
        'success': True,
        'message': "Payment recorded successfully! Invoice marked as Paid."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= SUPPLIER & VENDOR MANAGEMENT API =================
  // GET: Fetch all suppliers with aggregated purchase amounts and dates
  app.get("/api/suppliers", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    rows = cur.execute("""
        SELECT s.id, s.name, s.company_name, s.mobile, s.email, s.address, s.notes, s.created_at,
               COALESCE(p.tot_purchases, s.total_purchases, 0.0) as total_purchases,
               COALESCE(p.last_date, s.last_purchase_date) as last_purchase_date,
               COALESCE(p.purchase_count, 0) as purchase_count
        FROM suppliers s
        LEFT JOIN (
            SELECT supplier_id,
                   COUNT(*) as purchase_count,
                   SUM(total_amount) as tot_purchases,
                   MAX(purchase_date) as last_date
            FROM supplier_purchases
            GROUP BY supplier_id
        ) p ON s.id = p.supplier_id
        ORDER BY total_purchases DESC, s.id DESC
    """).fetchall()

    suppliers = []
    tot_purchases_all = 0.0
    for r in rows:
        d = dict(r)
        d['total_purchases'] = round(float(d.get('total_purchases') or 0.0), 2)
        d['purchase_count'] = int(d.get('purchase_count') or 0)
        if not d.get('email'): d['email'] = ''
        if not d.get('address'): d['address'] = ''
        if not d.get('notes'): d['notes'] = ''
        if not d.get('last_purchase_date'): d['last_purchase_date'] = ''
        tot_purchases_all += d['total_purchases']
        suppliers.append(d)

    summary = {
        'total_suppliers': len(suppliers),
        'total_purchases': round(tot_purchases_all, 2),
        'active_suppliers': len([s for s in suppliers if s['total_purchases'] > 0])
    }
    print(json.dumps({'success': True, 'suppliers': suppliers, 'summary': summary}))
except Exception as e:
    print(json.dumps({'success': False, 'suppliers': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/suppliers error:", err);
      res.status(500).json({ success: false, suppliers: [], error: err.message });
    }
  });

  // GET: Fetch single supplier by ID
  app.get("/api/suppliers/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid supplier ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

sid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT * FROM suppliers WHERE id = ?", (sid,)).fetchone()
    if not row:
        print(json.dumps({'success': False, 'error': 'Supplier not found', 'not_found': True}))
    else:
        sup = dict(row)
        print(json.dumps({'success': True, 'supplier': sup}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET: Fetch supplier purchases / orders history
  app.get("/api/suppliers/:id/purchases", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid supplier ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

sid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    s_row = cur.execute("SELECT * FROM suppliers WHERE id = ?", (sid,)).fetchone()
    if not s_row:
        print(json.dumps({'success': False, 'error': 'Supplier not found', 'not_found': True}))
        sys.exit(0)

    rows = cur.execute("""
        SELECT * FROM supplier_purchases
        WHERE supplier_id = ?
        ORDER BY purchase_date DESC, id DESC
    """, (sid,)).fetchall()

    purchases = [dict(r) for r in rows]
    total_spent = sum(float(p.get('total_amount') or 0.0) for p in purchases)
    last_date = purchases[0]['purchase_date'] if len(purchases) > 0 else ''

    print(json.dumps({
        'success': True,
        'supplier': dict(s_row),
        'purchases': purchases,
        'total_spent': round(total_spent, 2),
        'last_purchase_date': last_date
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Add new supplier
  app.post("/api/suppliers", async (req, res) => {
    const { name, company_name, mobile, email, address, notes } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Supplier Name is required." });
    }
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, error: "Company Name is required." });
    }
    if (!mobile || !mobile.trim()) {
      return res.status(400).json({ success: false, error: "Mobile Number is required." });
    }

    const payload = {
      name: name.trim(),
      company_name: company_name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim() : "",
      address: address ? address.trim() : "",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        INSERT INTO suppliers (name, company_name, mobile, email, address, notes, total_purchases)
        VALUES (?, ?, ?, ?, ?, ?, 0.0)
    """, (
        args['name'],
        args['company_name'],
        args['mobile'],
        args['email'],
        args['address'],
        args['notes']
    ))
    conn.commit()
    new_id = cur.lastrowid
    row = cur.execute("SELECT * FROM suppliers WHERE id = ?", (new_id,)).fetchone()
    print(json.dumps({
        'success': True,
        'supplier': dict(row),
        'message': f"Supplier '{args['company_name']}' added successfully."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(400).json({ success: false, error: data.error || "Failed to add supplier" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/suppliers error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Update supplier
  app.put("/api/suppliers/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid supplier ID" });
    }

    const { name, company_name, mobile, email, address, notes } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Supplier Name is required." });
    }
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, error: "Company Name is required." });
    }
    if (!mobile || !mobile.trim()) {
      return res.status(400).json({ success: false, error: "Mobile Number is required." });
    }

    const payload = {
      id,
      name: name.trim(),
      company_name: company_name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim() : "",
      address: address ? address.trim() : "",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    old = cur.execute("SELECT id FROM suppliers WHERE id = ?", (args['id'],)).fetchone()
    if not old:
        print(json.dumps({'success': False, 'error': 'Supplier not found', 'not_found': True}))
        sys.exit(0)

    cur.execute("""
        UPDATE suppliers
        SET name = ?,
            company_name = ?,
            mobile = ?,
            email = ?,
            address = ?,
            notes = ?
        WHERE id = ?
    """, (
        args['name'],
        args['company_name'],
        args['mobile'],
        args['email'],
        args['address'],
        args['notes'],
        args['id']
    ))
    conn.commit()

    updated = cur.execute("""
        SELECT s.id, s.name, s.company_name, s.mobile, s.email, s.address, s.notes, s.created_at,
               COALESCE(p.tot_purchases, s.total_purchases, 0.0) as total_purchases,
               COALESCE(p.last_date, s.last_purchase_date) as last_purchase_date
        FROM suppliers s
        LEFT JOIN (
            SELECT supplier_id, SUM(total_amount) as tot_purchases, MAX(purchase_date) as last_date
            FROM supplier_purchases
            WHERE supplier_id = ?
            GROUP BY supplier_id
        ) p ON s.id = p.supplier_id
        WHERE s.id = ?
    """, (args['id'], args['id'])).fetchone()

    print(json.dumps({
        'success': True,
        'supplier': dict(updated),
        'message': f"Supplier '{args['company_name']}' updated successfully."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const code = data.not_found ? 404 : 400;
        return res.status(code).json({ success: false, error: data.error || "Failed to update supplier" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`PUT /api/suppliers/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete supplier
  app.delete("/api/suppliers/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid supplier ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

sid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    s_row = cur.execute("SELECT company_name FROM suppliers WHERE id = ?", (sid,)).fetchone()
    if not s_row:
        print(json.dumps({'success': False, 'error': 'Supplier not found', 'not_found': True}))
        sys.exit(0)

    c_name = s_row['company_name']
    cur.execute("DELETE FROM supplier_purchases WHERE supplier_id = ?", (sid,))
    cur.execute("DELETE FROM suppliers WHERE id = ?", (sid,))
    conn.commit()

    print(json.dumps({
        'success': True,
        'message': f"Supplier '{c_name}' removed from directory."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/suppliers/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Record purchase from supplier
  app.post("/api/suppliers/:id/purchases", async (req, res) => {
    const supplierId = parseInt(req.params.id, 10);
    if (isNaN(supplierId)) {
      return res.status(400).json({ success: false, error: "Invalid supplier ID" });
    }

    const { product_name, quantity, unit_cost, purchase_date, payment_status, payment_method, notes } = req.body || {};

    if (!product_name || !product_name.trim()) {
      return res.status(400).json({ success: false, error: "Product / Item name is required." });
    }

    const numQty = parseInt(quantity, 10) || 1;
    const numCost = parseFloat(unit_cost) || 0.0;
    const totAmount = Math.round(numQty * numCost * 100) / 100;
    const dateStr = purchase_date && purchase_date.trim() ? purchase_date.trim() : new Date().toISOString().split("T")[0];
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const payload = {
      supplier_id: supplierId,
      purchase_order_no: poNumber,
      product_name: product_name.trim(),
      quantity: numQty,
      unit_cost: numCost,
      total_amount: totAmount,
      purchase_date: dateStr,
      payment_status: payment_status || "Paid",
      payment_method: payment_method || "Net Banking",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    s_row = cur.execute("SELECT company_name FROM suppliers WHERE id = ?", (args['supplier_id'],)).fetchone()
    if not s_row:
        print(json.dumps({'success': False, 'error': 'Supplier not found', 'not_found': True}))
        sys.exit(0)

    cur.execute("""
        INSERT INTO supplier_purchases (supplier_id, purchase_order_no, product_name, quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        args['supplier_id'],
        args['purchase_order_no'],
        args['product_name'],
        args['quantity'],
        args['unit_cost'],
        args['total_amount'],
        args['purchase_date'],
        args['payment_status'],
        args['payment_method'],
        args['notes']
    ))
    new_pid = cur.lastrowid

    # Recalculate supplier totals
    stats = cur.execute("""
        SELECT COALESCE(SUM(total_amount), 0.0), MAX(purchase_date)
        FROM supplier_purchases
        WHERE supplier_id = ?
    """, (args['supplier_id'],)).fetchone()

    cur.execute("""
        UPDATE suppliers
        SET total_purchases = ?,
            last_purchase_date = ?
        WHERE id = ?
    """, (stats[0], stats[1], args['supplier_id']))

    # Also log in stock movements if item matches a product
    p_row = cur.execute("SELECT id, name, stock_quantity FROM products WHERE LOWER(name) = LOWER(?)", (args['product_name'],)).fetchone()
    if p_row:
        old_stk = p_row['stock_quantity'] or 0
        new_stk = old_stk + args['quantity']
        cur.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", (new_stk, p_row['id']))
        cur.execute("""
            INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
            VALUES (?, ?, 'Restock', ?, ?, ?, ?, ?)
        """, (p_row['id'], p_row['name'], args['quantity'], old_stk, new_stk, args['purchase_order_no'], f"Supplier PO from {s_row['company_name']}"))

    conn.commit()

    created = cur.execute("SELECT * FROM supplier_purchases WHERE id = ?", (new_pid,)).fetchone()
    print(json.dumps({
        'success': True,
        'purchase': dict(created),
        'message': f"Purchase order '{args['purchase_order_no']}' recorded successfully."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(400).json({ success: false, error: data.error || "Failed to record purchase" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/suppliers/:id/purchases error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= PURCHASE MANAGEMENT API (Requirements 1, 2, 3, 4, 5, 8, 9) =================
  // GET: Fetch all purchases with supplier and product details
  app.get("/api/purchases", async (req, res) => {
    const { search, supplier_id, product_id, start_date, end_date } = req.query || {};

    const filters = {
      search: search ? String(search).trim() : "",
      supplier_id: supplier_id ? parseInt(String(supplier_id), 10) : null,
      product_id: product_id ? parseInt(String(product_id), 10) : null,
      start_date: start_date ? String(start_date).trim() : "",
      end_date: end_date ? String(end_date).trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os

filters = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    query = """
        SELECT 
            p.id,
            p.supplier_id,
            COALESCE(NULLIF(p.invoice_no, ''), NULLIF(p.purchase_order_no, ''), 'INV-PUR-' || p.id) as invoice_no,
            COALESCE(p.purchase_order_no, p.invoice_no) as purchase_order_no,
            p.product_id,
            p.product_name,
            p.quantity,
            p.unit_cost,
            p.total_amount,
            p.purchase_date,
            COALESCE(p.payment_status, 'Paid') as payment_status,
            COALESCE(p.payment_method, 'Net Banking') as payment_method,
            COALESCE(p.notes, '') as notes,
            p.created_at,
            s.name as supplier_name,
            s.company_name as supplier_company,
            s.mobile as supplier_mobile,
            s.email as supplier_email,
            pr.category as product_category,
            pr.sku as product_sku,
            pr.stock_quantity as current_product_stock,
            pr.price as product_selling_price
        FROM supplier_purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN products pr ON (p.product_id IS NOT NULL AND p.product_id = pr.id) OR (LOWER(TRIM(p.product_name)) = LOWER(TRIM(pr.name)))
        WHERE 1=1
    """
    params = []

    if filters.get('supplier_id'):
        query += " AND p.supplier_id = ?"
        params.append(filters['supplier_id'])

    if filters.get('product_id'):
        query += " AND (p.product_id = ? OR pr.id = ?)"
        params.extend([filters['product_id'], filters['product_id']])

    if filters.get('start_date'):
        query += " AND p.purchase_date >= ?"
        params.append(filters['start_date'])

    if filters.get('end_date'):
        query += " AND p.purchase_date <= ?"
        params.append(filters['end_date'])

    if filters.get('search'):
        s_term = f"%{filters['search'].lower()}%"
        query += """ AND (
            LOWER(p.purchase_order_no) LIKE ? OR 
            LOWER(COALESCE(p.invoice_no, '')) LIKE ? OR 
            LOWER(p.product_name) LIKE ? OR 
            LOWER(COALESCE(s.name, '')) LIKE ? OR 
            LOWER(COALESCE(s.company_name, '')) LIKE ? OR 
            LOWER(COALESCE(p.notes, '')) LIKE ?
        )"""
        params.extend([s_term, s_term, s_term, s_term, s_term, s_term])

    query += " ORDER BY p.purchase_date DESC, p.id DESC"

    rows = cur.execute(query, params).fetchall()
    purchases = [dict(r) for r in rows]

    total_amount = sum(float(p.get('total_amount') or 0.0) for p in purchases)
    total_qty = sum(int(p.get('quantity') or 0) for p in purchases)

    print(json.dumps({
        'success': True,
        'purchases': purchases,
        'total_amount': round(total_amount, 2),
        'total_quantity': total_qty,
        'count': len(purchases)
    }))
except Exception as e:
    print(json.dumps({'success': False, 'purchases': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(filters)]);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/purchases error:", err);
      res.status(500).json({ success: false, purchases: [], error: err.message });
    }
  });

  // GET: Fetch single purchase by ID
  app.get("/api/purchases/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid purchase ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

pid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("""
        SELECT 
            p.id,
            p.supplier_id,
            COALESCE(NULLIF(p.invoice_no, ''), NULLIF(p.purchase_order_no, ''), 'INV-PUR-' || p.id) as invoice_no,
            COALESCE(p.purchase_order_no, p.invoice_no) as purchase_order_no,
            p.product_id,
            p.product_name,
            p.quantity,
            p.unit_cost,
            p.total_amount,
            p.purchase_date,
            COALESCE(p.payment_status, 'Paid') as payment_status,
            COALESCE(p.payment_method, 'Net Banking') as payment_method,
            COALESCE(p.notes, '') as notes,
            p.created_at,
            s.name as supplier_name,
            s.company_name as supplier_company,
            s.mobile as supplier_mobile,
            s.email as supplier_email,
            s.address as supplier_address,
            pr.category as product_category,
            pr.sku as product_sku,
            pr.stock_quantity as current_product_stock,
            pr.price as product_selling_price
        FROM supplier_purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN products pr ON (p.product_id IS NOT NULL AND p.product_id = pr.id) OR (LOWER(TRIM(p.product_name)) = LOWER(TRIM(pr.name)))
        WHERE p.id = ?
    """, (pid,)).fetchone()

    if not row:
        print(json.dumps({'success': False, 'error': 'Purchase not found', 'not_found': True}))
    else:
        print(json.dumps({'success': True, 'purchase': dict(row)}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Record new purchase (Requirements 2, 3, 6, 7, 8, 9)
  app.post("/api/purchases", async (req, res) => {
    const {
      supplier_id,
      product_id,
      product_name,
      quantity,
      unit_cost,
      total_amount,
      purchase_date,
      invoice_no,
      payment_status,
      payment_method,
      notes
    } = req.body || {};

    // Validations (Requirement 6)
    const supId = parseInt(supplier_id, 10);
    if (isNaN(supId) || supId <= 0) {
      return res.status(400).json({ success: false, error: "Supplier is required. Please select a valid supplier." });
    }

    if (!product_name || !product_name.trim()) {
      return res.status(400).json({ success: false, error: "Product is required. Please select or enter a product." });
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, error: "Purchase quantity must be greater than 0." });
    }

    const numCost = parseFloat(unit_cost);
    if (isNaN(numCost) || numCost < 0) {
      return res.status(400).json({ success: false, error: "Purchase price per unit cannot be negative." });
    }

    const calculatedTotal = total_amount !== undefined && !isNaN(parseFloat(total_amount))
      ? Math.round(parseFloat(total_amount) * 100) / 100
      : Math.round(numQty * numCost * 100) / 100;

    const purDate = purchase_date && purchase_date.trim()
      ? purchase_date.trim()
      : new Date().toISOString().split("T")[0];

    // Generate or format invoice / bill number
    const invNo = invoice_no && invoice_no.trim()
      ? invoice_no.trim()
      : `INV-PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      supplier_id: supId,
      product_id: product_id ? parseInt(product_id, 10) : null,
      product_name: product_name.trim(),
      quantity: numQty,
      unit_cost: numCost,
      total_amount: calculatedTotal,
      purchase_date: purDate,
      invoice_no: invNo,
      purchase_order_no: invNo,
      payment_status: payment_status || "Paid",
      payment_method: payment_method || "Net Banking",
      notes: notes ? notes.trim() : ""
    };

    const pythonScript = `
import sqlite3, json, sys, os, time

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # 1. Verify supplier exists
    s_row = cur.execute("SELECT id, name, company_name FROM suppliers WHERE id = ?", (args['supplier_id'],)).fetchone()
    if not s_row:
        print(json.dumps({'success': False, 'error': f"Supplier ID {args['supplier_id']} not found."}))
        sys.exit(0)

    # 2. Find matching product in products catalog
    p_row = None
    if args.get('product_id'):
        p_row = cur.execute("SELECT id, name, category, stock_quantity, purchase_price, price FROM products WHERE id = ?", (args['product_id'],)).fetchone()
    if not p_row:
        p_row = cur.execute("SELECT id, name, category, stock_quantity, purchase_price, price FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))", (args['product_name'],)).fetchone()

    prod_id = None
    prod_name = args['product_name']

    if p_row:
        prod_id = p_row['id']
        prod_name = p_row['name']
        old_stk = int(p_row['stock_quantity'] or 0)
        new_stk = old_stk + args['quantity']

        # Update product stock and update cost/purchase_price to reflect current purchase valuation
        cur.execute("""
            UPDATE products 
            SET stock_quantity = ?, 
                purchase_price = ? 
            WHERE id = ?
        """, (new_stk, args['unit_cost'], prod_id))

        # Record stock movement
        cur.execute("""
            INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
            VALUES (?, ?, 'Restock', ?, ?, ?, ?, ?)
        """, (prod_id, prod_name, args['quantity'], old_stk, new_stk, args['invoice_no'], f"Purchased from {s_row['company_name']}"))
    else:
        # Create product in catalog so inventory accurately reflects the new item
        selling_est = round(args['unit_cost'] * 1.3, 2)
        sku_code = f"SKU-{int(time.time()) % 100000}"
        cur.execute("""
            INSERT INTO products (name, category, price, purchase_price, stock_quantity, min_stock_level, sku)
            VALUES (?, 'General', ?, ?, ?, 5, ?)
        """, (prod_name, selling_est, args['unit_cost'], args['quantity'], sku_code))
        prod_id = cur.lastrowid

        # Record initial stock movement
        cur.execute("""
            INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
            VALUES (?, ?, 'Stock Added', ?, 0, ?, ?, ?)
        """, (prod_id, prod_name, args['quantity'], args['quantity'], args['invoice_no'], f"Initial intake from {s_row['company_name']}"))

    # 3. Insert purchase record
    cur.execute("""
        INSERT INTO supplier_purchases (
            supplier_id, purchase_order_no, invoice_no, product_id, product_name, 
            quantity, unit_cost, total_amount, purchase_date, payment_status, payment_method, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        args['supplier_id'],
        args['invoice_no'],
        args['invoice_no'],
        prod_id,
        prod_name,
        args['quantity'],
        args['unit_cost'],
        args['total_amount'],
        args['purchase_date'],
        args['payment_status'],
        args['payment_method'],
        args['notes']
    ))
    new_pid = cur.lastrowid

    # 4. Update supplier total purchases and last purchase date (Requirement 3)
    stats = cur.execute("""
        SELECT COALESCE(SUM(total_amount), 0.0), MAX(purchase_date)
        FROM supplier_purchases
        WHERE supplier_id = ?
    """, (args['supplier_id'],)).fetchone()

    cur.execute("""
        UPDATE suppliers
        SET total_purchases = ?,
            last_purchase_date = ?
        WHERE id = ?
    """, (stats[0], stats[1], args['supplier_id']))

    conn.commit()

    # Query back created record
    created = cur.execute("""
        SELECT 
            p.id,
            p.supplier_id,
            COALESCE(NULLIF(p.invoice_no, ''), NULLIF(p.purchase_order_no, ''), 'INV-PUR-' || p.id) as invoice_no,
            COALESCE(p.purchase_order_no, p.invoice_no) as purchase_order_no,
            p.product_id,
            p.product_name,
            p.quantity,
            p.unit_cost,
            p.total_amount,
            p.purchase_date,
            COALESCE(p.payment_status, 'Paid') as payment_status,
            COALESCE(p.payment_method, 'Net Banking') as payment_method,
            COALESCE(p.notes, '') as notes,
            p.created_at,
            s.name as supplier_name,
            s.company_name as supplier_company,
            s.mobile as supplier_mobile
        FROM supplier_purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
    """, (new_pid,)).fetchone()

    print(json.dumps({
        'success': True,
        'purchase': dict(created),
        'message': f"Purchase '{args['invoice_no']}' recorded successfully. Inventory stock increased by {args['quantity']} units."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(400).json({ success: false, error: data.error || "Failed to record purchase" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/purchases error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete purchase record and reverse inventory & supplier metrics
  app.delete("/api/purchases/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid purchase ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

pid = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    p_row = cur.execute("SELECT * FROM supplier_purchases WHERE id = ?", (pid,)).fetchone()
    if not p_row:
        print(json.dumps({'success': False, 'error': 'Purchase record not found', 'not_found': True}))
        sys.exit(0)

    p_dict = dict(p_row)
    sup_id = p_dict['supplier_id']
    prod_id = p_dict.get('product_id')
    prod_name = p_dict['product_name']
    qty = int(p_dict['quantity'] or 0)
    inv_no = p_dict.get('invoice_no') or p_dict.get('purchase_order_no') or f"INV-PUR-{pid}"

    # Reverse product stock
    matching_prod = None
    if prod_id:
        matching_prod = cur.execute("SELECT id, name, stock_quantity FROM products WHERE id = ?", (prod_id,)).fetchone()
    if not matching_prod and prod_name:
        matching_prod = cur.execute("SELECT id, name, stock_quantity FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))", (prod_name,)).fetchone()

    if matching_prod:
        old_stk = int(matching_prod['stock_quantity'] or 0)
        new_stk = max(0, old_stk - qty)
        cur.execute("UPDATE products SET stock_quantity = ? WHERE id = ?", (new_stk, matching_prod['id']))
        cur.execute("""
            INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, previous_stock, new_stock, reference_id, notes)
            VALUES (?, ?, 'Adjustment', ?, ?, ?, ?, ?)
        """, (matching_prod['id'], matching_prod['name'], -qty, old_stk, new_stk, inv_no, f"Reversed deleted purchase {inv_no}"))

    # Delete purchase record
    cur.execute("DELETE FROM supplier_purchases WHERE id = ?", (pid,))

    # Recalculate supplier totals
    stats = cur.execute("""
        SELECT COALESCE(SUM(total_amount), 0.0), MAX(purchase_date)
        FROM supplier_purchases
        WHERE supplier_id = ?
    """, (sup_id,)).fetchone()

    cur.execute("""
        UPDATE suppliers
        SET total_purchases = ?,
            last_purchase_date = ?
        WHERE id = ?
    """, (stats[0] if stats else 0.0, stats[1] if (stats and stats[1]) else None, sup_id))

    conn.commit()

    print(json.dumps({
        'success': True,
        'message': f"Purchase '{inv_no}' removed and inventory stock adjusted."
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const code = data.not_found ? 404 : 500;
        return res.status(code).json({ success: false, error: data.error });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/purchases/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= BUSINESS ANALYTICS & PROFIT/LOSS API (Advanced Analytics Upgrade) =================
  const handleAnalyticsRequest = async (req: any, res: any) => {
    const { period = "7days", start_date = "", end_date = "" } = req.query || {};

    const payload = {
      period: String(period),
      start_date: start_date ? String(start_date).trim() : "",
      end_date: end_date ? String(end_date).trim() : "",
    };

    const pythonScript = `
import sqlite3, json, sys, os, datetime

args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
period = args.get('period', '7days')
custom_start = args.get('start_date')
custom_end = args.get('end_date')

today = datetime.date.today()
today_str = today.isoformat()

start_date = None
end_date = None
prior_start = None
prior_end = None

if period == 'today':
    start_date = today_str
    end_date = today_str
    prior_start = (today - datetime.timedelta(days=1)).isoformat()
    prior_end = prior_start
elif period == 'this_week':
    start_date = (today - datetime.timedelta(days=today.weekday())).isoformat()
    end_date = today_str
    prior_start = (datetime.date.fromisoformat(start_date) - datetime.timedelta(days=7)).isoformat()
    prior_end = (datetime.date.fromisoformat(end_date) - datetime.timedelta(days=7)).isoformat()
elif period == '7days':
    start_date = (today - datetime.timedelta(days=7)).isoformat()
    end_date = today_str
    prior_start = (today - datetime.timedelta(days=14)).isoformat()
    prior_end = (today - datetime.timedelta(days=8)).isoformat()
elif period == 'this_month':
    start_date = today.replace(day=1).isoformat()
    end_date = today_str
    last_day_prev = today.replace(day=1) - datetime.timedelta(days=1)
    prior_start = last_day_prev.replace(day=1).isoformat()
    prior_end = last_day_prev.isoformat()
elif period == 'last_month':
    last_day_prev = today.replace(day=1) - datetime.timedelta(days=1)
    start_date = last_day_prev.replace(day=1).isoformat()
    end_date = last_day_prev.isoformat()
    prev_prev_last = last_day_prev.replace(day=1) - datetime.timedelta(days=1)
    prior_start = prev_prev_last.replace(day=1).isoformat()
    prior_end = prev_prev_last.isoformat()
elif period == 'custom':
    start_date = custom_start if custom_start else None
    end_date = custom_end if custom_end else None
    if start_date and end_date:
        try:
            d1 = datetime.date.fromisoformat(start_date)
            d2 = datetime.date.fromisoformat(end_date)
            diff = max(1, (d2 - d1).days + 1)
            prior_start = (d1 - datetime.timedelta(days=diff)).isoformat()
            prior_end = (d1 - datetime.timedelta(days=1)).isoformat()
        except:
            prior_start, prior_end = None, None

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def table_exists(tbl):
    return cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (tbl,)).fetchone() is not None

try:
    # 1. Product Lookup for Costs, Profitability & Inventory Valuation
    products_dict = {}
    name_to_id = {}
    total_inventory_value = 0.0
    low_stock_products = []

    if table_exists('products'):
        for p in cur.execute("SELECT id, name, category, sku, price, purchase_price, stock_quantity, min_stock_level FROM products").fetchall():
            cost = float(p['purchase_price'] or 0.0)
            price = float(p['price'] or 0.0)
            if cost <= 0 and price > 0:
                cost = round(price * 0.70, 2)
            stock = int(p['stock_quantity'] or 0)
            min_lvl = int(p['min_stock_level'] or 10)
            total_inventory_value += round(stock * cost, 2)
            if stock <= min_lvl:
                low_stock_products.append({
                    'id': p['id'],
                    'name': p['name'],
                    'category': p['category'] or 'General',
                    'stock_quantity': stock,
                    'min_stock_level': min_lvl,
                    'price': price,
                    'cost': cost
                })
            products_dict[p['id']] = {
                'id': p['id'],
                'name': p['name'],
                'category': p['category'] or 'General',
                'sku': p['sku'] or '',
                'unit_price': price,
                'unit_cost': cost,
                'stock_remaining': stock,
                'units_sold': 0,
                'selling_revenue': 0.0,
                'purchase_cost': 0.0,
                'gross_profit': 0.0,
                'profit_margin': 0.0
            }
            name_to_id[p['name'].lower().strip()] = p['id']

    low_stock_products.sort(key=lambda x: x['stock_quantity'])
    total_inventory_value = round(total_inventory_value, 2)

    # 2. Sales in Period
    sales_query = "SELECT * FROM sales WHERE 1=1"
    sales_params = []
    if start_date:
        sales_query += " AND date(sale_date) >= date(?)"
        sales_params.append(start_date)
    if end_date:
        sales_query += " AND date(sale_date) <= date(?)"
        sales_params.append(end_date)
    sales_query += " ORDER BY date(sale_date) ASC, id ASC"

    sales_rows = cur.execute(sales_query, sales_params).fetchall() if table_exists('sales') else []
    sales_list = [dict(r) for r in sales_rows]
    sale_ids = [s['id'] for s in sales_list]

    total_sales = 0.0
    paid_revenue = 0.0
    pending_revenue = 0.0
    customer_map = {}
    sales_by_date_map = {}
    weekly_map = {}
    monthly_map = {}

    for s in sales_list:
        amt = float(s['total_amount'] or 0.0)
        total_sales += amt
        p_status = (s.get('payment_status') or 'Paid').lower()
        if p_status == 'paid':
            paid_revenue += amt
        else:
            pending_revenue += amt

        # Sales by date
        d_str = s['sale_date'] or today_str
        if d_str not in sales_by_date_map:
            sales_by_date_map[d_str] = {'date': d_str, 'orders': 0, 'revenue': 0.0}
        sales_by_date_map[d_str]['orders'] += 1
        sales_by_date_map[d_str]['revenue'] = round(sales_by_date_map[d_str]['revenue'] + amt, 2)

        # Weekly grouping
        try:
            dt = datetime.date.fromisoformat(d_str)
            yr, wk, _ = dt.isocalendar()
            wk_key = f"{yr}-W{wk:02d}"
            wk_label = f"Week {wk}"
        except:
            wk_key = "Week-Unknown"
            wk_label = "Unknown"
        if wk_key not in weekly_map:
            weekly_map[wk_key] = {'week_key': wk_key, 'label': wk_label, 'sales': 0.0, 'orders': 0, 'net_profit': 0.0}
        weekly_map[wk_key]['sales'] = round(weekly_map[wk_key]['sales'] + amt, 2)
        weekly_map[wk_key]['orders'] += 1

        # Monthly grouping
        m_key = d_str[:7]
        try:
            m_lbl = datetime.datetime.strptime(m_key, "%Y-%m").strftime("%b %Y")
        except:
            m_lbl = m_key
        if m_key not in monthly_map:
            monthly_map[m_key] = {'month_key': m_key, 'label': m_lbl, 'sales': 0.0, 'orders': 0, 'expenses': 0.0, 'net_profit': 0.0}
        monthly_map[m_key]['sales'] = round(monthly_map[m_key]['sales'] + amt, 2)
        monthly_map[m_key]['orders'] += 1

        # Sales by customer
        c_name = s['customer_name'] or 'Walk-in Customer'
        c_phone = s.get('customer_phone') or ''
        if c_name not in customer_map:
            customer_map[c_name] = {'name': c_name, 'phone': c_phone, 'orders_count': 0, 'total_spent': 0.0, 'avg_order_value': 0.0}
        customer_map[c_name]['orders_count'] += 1
        customer_map[c_name]['total_spent'] = round(customer_map[c_name]['total_spent'] + amt, 2)

    total_sales = round(total_sales, 2)
    paid_revenue = round(paid_revenue, 2)
    pending_revenue = round(pending_revenue, 2)
    total_orders = len(sales_list)
    total_units_sold = 0
    total_cogs = 0.0

    # Calculate Prior Sales & Growth Percentage
    prior_sales = 0.0
    if prior_start and prior_end and table_exists('sales'):
        ps_row = cur.execute("SELECT SUM(total_amount) as s FROM sales WHERE date(sale_date) >= date(?) AND date(sale_date) <= date(?)", (prior_start, prior_end)).fetchone()
        if ps_row and ps_row['s']:
            prior_sales = round(float(ps_row['s']), 2)

    if prior_sales > 0:
        sales_growth_pct = round(((total_sales - prior_sales) / prior_sales) * 100, 1)
    else:
        sales_growth_pct = 100.0 if total_sales > 0 else 0.0

    daily_map = {}
    trend_days = 7 if (period in ['7days', 'this_week']) else (1 if period == 'today' else 14)
    for i in range(trend_days - 1, -1, -1):
        td = today - datetime.timedelta(days=i)
        td_str = td.isoformat()
        lbl = td.strftime('%b %d')
        daily_map[td_str] = {
            'date': td_str,
            'label': lbl,
            'sales': 0.0,
            'orders': 0,
            'cogs': 0.0,
            'gross_profit': 0.0,
            'expenses': 0.0,
            'net_profit': 0.0
        }

    # Query sale items for exact COGS and product profitability
    sale_by_id = {s['id']: s for s in sales_list}
    if sale_ids and table_exists('sale_items'):
        placeholders = ','.join('?' for _ in sale_ids)
        items_rows = cur.execute(f"SELECT * FROM sale_items WHERE sale_id IN ({placeholders})", sale_ids).fetchall()
        for it in items_rows:
            sid = it['sale_id']
            s_rec = sale_by_id.get(sid, {})
            s_date = s_rec.get('sale_date') or today_str
            qty = int(it['quantity'] or 1)
            total_units_sold += qty
            item_rev = float(it['total_price'] or 0.0)

            pid = it['product_id']
            if not pid or pid not in products_dict:
                it_name = (it['product_name'] or '').lower().strip()
                pid = name_to_id.get(it_name)

            if pid and pid in products_dict:
                u_cost = products_dict[pid]['unit_cost']
                item_cogs = round(qty * u_cost, 2)
                products_dict[pid]['units_sold'] += qty
                products_dict[pid]['selling_revenue'] = round(products_dict[pid]['selling_revenue'] + item_rev, 2)
                products_dict[pid]['purchase_cost'] = round(products_dict[pid]['purchase_cost'] + item_cogs, 2)
            else:
                u_cost = round(float(it['unit_price'] or 0.0) * 0.70, 2)
                item_cogs = round(qty * u_cost, 2)

            total_cogs += item_cogs

            if s_date in daily_map:
                daily_map[s_date]['cogs'] = round(daily_map[s_date]['cogs'] + item_cogs, 2)
            elif s_date:
                daily_map[s_date] = {
                    'date': s_date,
                    'label': s_date,
                    'sales': 0.0,
                    'orders': 0,
                    'cogs': item_cogs,
                    'gross_profit': 0.0,
                    'expenses': 0.0,
                    'net_profit': 0.0
                }

    # Populate daily sales into daily_map
    for s in sales_list:
        d_str = s['sale_date'] or today_str
        amt = float(s['total_amount'] or 0.0)
        if d_str in daily_map:
            daily_map[d_str]['sales'] = round(daily_map[d_str]['sales'] + amt, 2)
            daily_map[d_str]['orders'] += 1
        else:
            daily_map[d_str] = {
                'date': d_str,
                'label': d_str,
                'sales': amt,
                'orders': 1,
                'cogs': 0.0,
                'gross_profit': 0.0,
                'expenses': 0.0,
                'net_profit': 0.0
            }

    # 3. Query Expenses in Period
    exp_query = "SELECT * FROM expenses WHERE 1=1"
    exp_params = []
    if start_date:
        exp_query += " AND date(expense_date) >= date(?)"
        exp_params.append(start_date)
    if end_date:
        exp_query += " AND date(expense_date) <= date(?)"
        exp_params.append(end_date)
    exp_query += " ORDER BY date(expense_date) ASC"

    exp_rows = cur.execute(exp_query, exp_params).fetchall() if table_exists('expenses') else []
    total_expenses = 0.0
    exp_categories_map = {}
    exp_trend_map = {}
    monthly_expense_map = {}

    for e in exp_rows:
        e_amt = float(e['amount'] or 0.0)
        total_expenses += e_amt
        cat = e['category'] or 'Other'
        if cat not in exp_categories_map:
            exp_categories_map[cat] = {'category': cat, 'amount': 0.0, 'count': 0}
        exp_categories_map[cat]['amount'] = round(exp_categories_map[cat]['amount'] + e_amt, 2)
        exp_categories_map[cat]['count'] += 1

        ed = e['expense_date'] or today_str
        exp_trend_map[ed] = round(exp_trend_map.get(ed, 0.0) + e_amt, 2)
        if ed in daily_map:
            daily_map[ed]['expenses'] = round(daily_map[ed]['expenses'] + e_amt, 2)
        else:
            daily_map[ed] = {
                'date': ed,
                'label': ed,
                'sales': 0.0,
                'orders': 0,
                'cogs': 0.0,
                'gross_profit': 0.0,
                'expenses': e_amt,
                'net_profit': 0.0
            }

        # Monthly expense trend
        m_key = ed[:7]
        try:
            m_lbl = datetime.datetime.strptime(m_key, "%Y-%m").strftime("%b %Y")
        except:
            m_lbl = m_key
        if m_key not in monthly_expense_map:
            monthly_expense_map[m_key] = {'month_key': m_key, 'label': m_lbl, 'amount': 0.0, 'count': 0}
        monthly_expense_map[m_key]['amount'] = round(monthly_expense_map[m_key]['amount'] + e_amt, 2)
        monthly_expense_map[m_key]['count'] += 1

    total_expenses = round(total_expenses, 2)
    total_cogs = round(total_cogs, 2)
    gross_profit = round(total_sales - total_cogs, 2)
    net_profit = round(gross_profit - total_expenses, 2)
    profit_margin = round((net_profit / total_sales * 100), 2) if total_sales > 0 else 0.0
    gross_margin = round((gross_profit / total_sales * 100), 2) if total_sales > 0 else 0.0
    avg_order_value = round(total_sales / total_orders, 2) if total_orders > 0 else 0.0

    # Calculate daily gross and net profit
    daily_sales_trend = []
    for d_key in sorted(daily_map.keys()):
        item = daily_map[d_key]
        item['gross_profit'] = round(item['sales'] - item['cogs'], 2)
        item['net_profit'] = round(item['gross_profit'] - item['expenses'], 2)
        daily_sales_trend.append(item)

    # Calculate product margins & profitability
    product_profitability = []
    for p in products_dict.values():
        p['gross_profit'] = round(p['selling_revenue'] - p['purchase_cost'], 2)
        p['profit_margin'] = round((p['gross_profit'] / p['selling_revenue'] * 100), 2) if p['selling_revenue'] > 0 else 0.0
        product_profitability.append(p)

    product_profitability.sort(key=lambda x: (x['selling_revenue'], x['units_sold']), reverse=True)

    # Top selling, highest revenue & low performing products
    top_selling = sorted([p for p in product_profitability if p['units_sold'] > 0], key=lambda x: x['units_sold'], reverse=True)[:10]
    highest_revenue = sorted([p for p in product_profitability if p['selling_revenue'] > 0], key=lambda x: x['selling_revenue'], reverse=True)[:10]
    low_performing = sorted(product_profitability, key=lambda x: (x['units_sold'], x['selling_revenue']))[:10]

    # Sales by date list
    sales_by_date = sorted(sales_by_date_map.values(), key=lambda x: x['date'], reverse=True)

    # 4. Customer Analytics (Total, New, Repeat, Top & Revenue Share)
    total_customers_count = 0
    if table_exists('customers'):
        c_count_row = cur.execute("SELECT COUNT(*) as c FROM customers").fetchone()
        total_customers_count = c_count_row['c'] if c_count_row else len(customer_map)
    else:
        total_customers_count = len(customer_map)

    repeat_customers_count = 0
    if table_exists('sales'):
        repeat_rows = cur.execute("SELECT customer_name, COUNT(*) as cnt FROM sales WHERE customer_name IS NOT NULL AND customer_name != '' GROUP BY customer_name HAVING cnt > 1").fetchall()
        repeat_customers_count = len(repeat_rows)

    new_customers_count = 0
    if table_exists('sales'):
        first_cust_rows = cur.execute("SELECT customer_name, MIN(date(sale_date)) as first_date FROM sales WHERE customer_name IS NOT NULL AND customer_name != '' GROUP BY customer_name").fetchall()
        for fc in first_cust_rows:
            f_date = fc['first_date']
            if f_date:
                in_win = True
                if start_date and f_date < start_date:
                    in_win = False
                if end_date and f_date > end_date:
                    in_win = False
                if in_win:
                    new_customers_count += 1

    sales_by_customer = []
    top_customers_analytics = []
    for c in sorted(customer_map.values(), key=lambda x: x['total_spent'], reverse=True):
        c['percentage'] = round((c['total_spent'] / total_sales * 100), 1) if total_sales > 0 else 0.0
        c['avg_order_value'] = round(c['total_spent'] / c['orders_count'], 2) if c['orders_count'] > 0 else 0.0
        sales_by_customer.append(c)
        top_customers_analytics.append(c)

    customer_revenue_contribution = [
        {'name': c['name'], 'total_spent': c['total_spent'], 'percentage': c['percentage']}
        for c in top_customers_analytics[:10]
    ]

    # Expense categories with percentage
    expense_categories = []
    for cat_data in sorted(exp_categories_map.values(), key=lambda x: x['amount'], reverse=True):
        cat_data['percentage'] = round((cat_data['amount'] / total_expenses * 100), 1) if total_expenses > 0 else 0.0
        expense_categories.append(cat_data)

    expense_trend = [{'date': d, 'label': d, 'amount': amt} for d, amt in sorted(exp_trend_map.items())]
    weekly_sales_trend = sorted(weekly_map.values(), key=lambda x: x['week_key'])
    monthly_sales_trend = sorted(monthly_map.values(), key=lambda x: x['month_key'])
    monthly_expense_trend = sorted(monthly_expense_map.values(), key=lambda x: x['month_key'])

    # Profit trend over time
    profit_trend = []
    for item in daily_sales_trend:
        rev = item['sales']
        np = item['net_profit']
        pm = round((np / rev * 100), 2) if rev > 0 else 0.0
        profit_trend.append({
            'date': item['date'],
            'label': item['label'],
            'gross_revenue': rev,
            'cogs': item['cogs'],
            'expenses': item['expenses'],
            'gross_profit': item['gross_profit'],
            'net_profit': np,
            'profit_margin': pm
        })

    # KPI Summary Cards (Requirement 6)
    kpis = {
        'revenue': total_sales,
        'net_profit': net_profit,
        'profit_margin': profit_margin,
        'total_orders': total_orders,
        'total_customers': total_customers_count,
        'inventory_value': total_inventory_value
    }

    print(json.dumps({
        'success': True,
        'period': period,
        'start_date': start_date,
        'end_date': end_date,
        'kpi': kpis,
        'sales_growth_pct': sales_growth_pct,
        'inventory_value': total_inventory_value,
        'pnl': {
            'total_sales': total_sales,
            'cogs': total_cogs,
            'gross_profit': gross_profit,
            'expenses': total_expenses,
            'net_profit': net_profit,
            'profit_margin': profit_margin,
            'gross_margin': gross_margin,
            'total_orders': total_orders,
            'total_units_sold': total_units_sold,
            'avg_order_value': avg_order_value
        },
        'profit_analytics': {
            'gross_revenue': total_sales,
            'total_expenses': total_expenses,
            'cogs': total_cogs,
            'gross_profit': gross_profit,
            'net_profit': net_profit,
            'profit_margin': profit_margin,
            'gross_margin': gross_margin,
            'profit_trend': profit_trend
        },
        'product_profitability': product_profitability,
        'product_analytics': {
            'top_10_selling': top_selling,
            'highest_revenue': highest_revenue,
            'low_performing': low_performing,
            'current_stock_value': total_inventory_value,
            'low_stock_products': low_stock_products
        },
        'customer_analytics': {
            'total_customers': total_customers_count,
            'new_customers': new_customers_count,
            'repeat_customers': repeat_customers_count,
            'top_customers': top_customers_analytics[:10],
            'customer_revenue_contribution': customer_revenue_contribution
        },
        'sales_analytics': {
            'daily_sales_trend': daily_sales_trend,
            'top_selling_products': top_selling,
            'highest_revenue_products': highest_revenue,
            'sales_by_date': sales_by_date,
            'sales_by_customer': sales_by_customer,
            'summary_cards': {
                'total_orders': total_orders,
                'total_units_sold': total_units_sold,
                'paid_revenue': paid_revenue,
                'pending_revenue': pending_revenue,
                'avg_order_value': avg_order_value,
                'sales_growth_pct': sales_growth_pct
            }
        },
        'expense_analytics': {
            'expense_categories': expense_categories,
            'total_expenses': total_expenses,
            'expense_trend': expense_trend,
            'highest_expense_categories': expense_categories[:5],
            'monthly_expense_trend': monthly_expense_trend
        },
        'weekly_sales_trend': weekly_sales_trend,
        'monthly_sales_trend': monthly_sales_trend,
        'monthly_expense_trend': monthly_expense_trend
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;

    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/analytics error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get("/api/analytics", handleAnalyticsRequest);
  app.get("/api/advanced-analytics", handleAnalyticsRequest);

  // ================= SMART INVENTORY & SALES ALERT SYSTEM =================
  // GET: Fetch real-time active smart alerts and calculate trends
  app.get("/api/alerts", async (_req, res) => {
    const pythonScript = `
import sqlite3, datetime, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    # Ensure tables exist
    cur.execute('''
    CREATE TABLE IF NOT EXISTS smart_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_key TEXT UNIQUE NOT NULL,
        alert_type TEXT NOT NULL,
        priority TEXT NOT NULL,
        category TEXT NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        current_stock INTEGER DEFAULT 0,
        threshold INTEGER DEFAULT 0,
        recent_units_sold INTEGER DEFAULT 0,
        previous_units_sold INTEGER DEFAULT 0,
        sales_velocity REAL DEFAULT 0.0,
        trend_percentage REAL DEFAULT 0.0,
        recommended_priority TEXT DEFAULT 'Medium',
        suggested_reorder_qty INTEGER DEFAULT 0,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        action_recommendation TEXT NOT NULL,
        period_info TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0,
        is_dismissed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS alert_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        analysis_period_days INTEGER DEFAULT 7,
        high_demand_threshold_pct REAL DEFAULT 40.0,
        slow_moving_threshold_pct REAL DEFAULT -40.0,
        min_sales_for_trend INTEGER DEFAULT 1,
        enable_stock_alerts INTEGER DEFAULT 1,
        enable_sales_trend_alerts INTEGER DEFAULT 1,
        critical_stock_ratio REAL DEFAULT 0.5,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    cur.execute('''
    INSERT OR IGNORE INTO alert_settings (id, analysis_period_days, high_demand_threshold_pct, slow_moving_threshold_pct, min_sales_for_trend, enable_stock_alerts, enable_sales_trend_alerts, critical_stock_ratio)
    VALUES (1, 7, 40.0, -40.0, 1, 1, 1, 0.5)
    ''')
    conn.commit()

    # Get settings
    cur.execute('SELECT * FROM alert_settings WHERE id = 1')
    cfg = dict(cur.fetchone())
    period_days = int(cfg.get('analysis_period_days') or 7)
    high_demand_pct = float(cfg.get('high_demand_threshold_pct') or 40.0)
    slow_moving_pct = float(cfg.get('slow_moving_threshold_pct') or -40.0)
    enable_stock = bool(cfg.get('enable_stock_alerts', 1))
    enable_trends = bool(cfg.get('enable_sales_trend_alerts', 1))
    crit_ratio = float(cfg.get('critical_stock_ratio') or 0.5)

    today = datetime.date.today()
    recent_start = today - datetime.timedelta(days=period_days - 1)
    prev_start = recent_start - datetime.timedelta(days=period_days)
    prev_end = recent_start - datetime.timedelta(days=1)
    period_label = f'Last {period_days} Days ({recent_start.strftime("%b %d")} - {today.strftime("%b %d")})'

    cur.execute('''
        WITH recent_s AS (
            SELECT COALESCE(si.product_id, p.id) as pid, SUM(si.quantity) as qty, SUM(si.total_price) as rev
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
            GROUP BY COALESCE(si.product_id, p.id)
        ),
        prev_s AS (
            SELECT COALESCE(si.product_id, p.id) as pid, SUM(si.quantity) as qty, SUM(si.total_price) as rev
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
            GROUP BY COALESCE(si.product_id, p.id)
        ),
        tot_s AS (
            SELECT COALESCE(si.product_id, p.id) as pid, SUM(si.quantity) as qty, COUNT(DISTINCT s.id) as order_count
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            GROUP BY COALESCE(si.product_id, p.id)
        )
        SELECT p.id, p.name, p.sku, p.category, COALESCE(p.supplier, '') as supplier,
               p.stock_quantity, p.min_stock_level, p.price,
               COALESCE(rs.qty, 0) as recent_qty,
               COALESCE(rs.rev, 0.0) as recent_rev,
               COALESCE(ps.qty, 0) as prev_qty,
               COALESCE(ps.rev, 0.0) as prev_rev,
               COALESCE(ts.qty, 0) as total_qty,
               COALESCE(ts.order_count, 0) as total_orders
        FROM products p
        LEFT JOIN recent_s rs ON p.id = rs.pid
        LEFT JOIN prev_s ps ON p.id = ps.pid
        LEFT JOIN tot_s ts ON p.id = ts.pid
        ORDER BY p.id ASC
    ''', (recent_start.isoformat(), today.isoformat(), prev_start.isoformat(), prev_end.isoformat()))

    products = cur.fetchall()
    alerts_to_upsert = []
    active_keys = set()
    product_tags = {}

    for p in products:
        pid = p['id']
        pname = p['name']
        stock = p['stock_quantity'] if p['stock_quantity'] is not None else 0
        min_lvl = p['min_stock_level'] if p['min_stock_level'] is not None else 5
        recent_q = p['recent_qty'] or 0
        prev_q = p['prev_qty'] or 0
        tot_orders = p['total_orders'] or 0
        supplier = p['supplier'] or ''

        velocity = round(recent_q / float(period_days), 2)
        tags = []

        if stock <= 0:
            tags.append('out_of_stock')
        elif stock <= min_lvl:
            tags.append('low_stock')
        else:
            tags.append('healthy')

        # Restock priority calculation (Requirement 9)
        if velocity > 0.8 or stock <= 2:
            rec_priority = 'High'
        elif velocity > 0.2 or stock <= min_lvl:
            rec_priority = 'Medium'
        else:
            rec_priority = 'Low'

        est_needed = max(min_lvl * 2, int(round(velocity * 14)) + min_lvl - stock)
        if est_needed < 1:
            est_needed = min_lvl

        # 1. OUT OF STOCK ALERT (Requirement 2)
        if enable_stock and stock <= 0:
            akey = f'out_of_stock:{pid}'
            active_keys.add(akey)
            sup_str = f' from supplier {supplier}' if supplier else ''
            alerts_to_upsert.append({
                'alert_key': akey,
                'alert_type': 'out_of_stock',
                'priority': 'CRITICAL',
                'category': 'critical',
                'product_id': pid,
                'product_name': pname,
                'current_stock': stock,
                'threshold': min_lvl,
                'recent_units_sold': recent_q,
                'previous_units_sold': prev_q,
                'sales_velocity': velocity,
                'trend_percentage': 0.0,
                'recommended_priority': 'High',
                'suggested_reorder_qty': est_needed,
                'title': f'🔴 Out of Stock: {pname}',
                'message': f'{pname} is currently out of stock. Consider purchasing new stock immediately.',
                'action_recommendation': f'Immediate replenishment recommended{sup_str}. Suggested reorder: {est_needed} units.',
                'period_info': period_label
            })

        # 2. LOW STOCK ALERT (Requirement 1)
        elif enable_stock and stock <= min_lvl:
            akey = f'low_stock:{pid}'
            active_keys.add(akey)
            is_very_low = stock <= max(2, int(round(min_lvl * crit_ratio)))
            prio = 'CRITICAL' if is_very_low else 'MEDIUM'
            cat = 'critical' if is_very_low else 'attention'
            prefix = '⚠️ Very Low Stock' if is_very_low else '⚠️ Low Stock Alert'
            sup_str = f' from {supplier}' if supplier else ''
            alerts_to_upsert.append({
                'alert_key': akey,
                'alert_type': 'low_stock',
                'priority': prio,
                'category': cat,
                'product_id': pid,
                'product_name': pname,
                'current_stock': stock,
                'threshold': min_lvl,
                'recent_units_sold': recent_q,
                'previous_units_sold': prev_q,
                'sales_velocity': velocity,
                'trend_percentage': 0.0,
                'recommended_priority': rec_priority,
                'suggested_reorder_qty': est_needed,
                'title': f'{prefix}: {pname}',
                'message': f'Product: {pname}\\nCurrent Stock: {stock}\\nMinimum Stock Level: {min_lvl}\\nAction: Consider restocking.',
                'action_recommendation': f'Recommended restock priority: {rec_priority}. Suggested reorder: {est_needed} units{sup_str}.',
                'period_info': period_label
            })

        # 3. HIGH-DEMAND / FAST-MOVING ALERT (Requirement 3 & 5)
        if enable_trends:
            is_high_demand = False
            trend_pct = 0.0
            if recent_q >= 2 and prev_q == 0:
                is_high_demand = True
                trend_pct = 100.0
            elif recent_q >= 2 and prev_q > 0:
                trend_pct = round(((recent_q - prev_q) / float(prev_q)) * 100.0, 1)
                if trend_pct >= high_demand_pct:
                    is_high_demand = True

            if is_high_demand:
                tags.append('high_demand')
                akey = f'high_demand:{pid}'
                active_keys.add(akey)
                alerts_to_upsert.append({
                    'alert_key': akey,
                    'alert_type': 'high_demand',
                    'priority': 'HIGH',
                    'category': 'attention',
                    'product_id': pid,
                    'product_name': pname,
                    'current_stock': stock,
                    'threshold': min_lvl,
                    'recent_units_sold': recent_q,
                    'previous_units_sold': prev_q,
                    'sales_velocity': velocity,
                    'trend_percentage': trend_pct,
                    'recommended_priority': 'High',
                    'suggested_reorder_qty': est_needed,
                    'title': f'🔥 High Demand Product: {pname}',
                    'message': f'{pname} is selling faster than usual. Sold: {recent_q} units during the selected period. Consider increasing stock.',
                    'action_recommendation': f'High sales velocity (+{trend_pct}% vs previous period). Increase stock buffer to prevent stockout.',
                    'period_info': period_label
                })

            # 4. SLOW-MOVING / DECLINING ALERT (Requirement 4 & 5)
            is_slow = False
            if tot_orders > 0:
                if prev_q >= 2 and recent_q == 0:
                    is_slow = True
                    trend_pct = -100.0
                elif prev_q >= 3 and recent_q > 0:
                    trend_pct = round(((recent_q - prev_q) / float(prev_q)) * 100.0, 1)
                    if trend_pct <= slow_moving_pct:
                        is_slow = True

            if is_slow:
                tags.append('slow_moving')
                akey = f'slow_moving:{pid}'
                active_keys.add(akey)
                alerts_to_upsert.append({
                    'alert_key': akey,
                    'alert_type': 'slow_moving',
                    'priority': 'MEDIUM',
                    'category': 'insight',
                    'product_id': pid,
                    'product_name': pname,
                    'current_stock': stock,
                    'threshold': min_lvl,
                    'recent_units_sold': recent_q,
                    'previous_units_sold': prev_q,
                    'sales_velocity': velocity,
                    'trend_percentage': trend_pct,
                    'recommended_priority': 'Low',
                    'suggested_reorder_qty': 0,
                    'title': f'📉 Slow-Moving Product: {pname}',
                    'message': f'{pname} has low sales activity. Sold: {recent_q} units during the selected period. Consider reviewing price, promotion or inventory.',
                    'action_recommendation': f'Sales declined by {abs(trend_pct)}%. Review pricing, run promotional bundling, or reduce future procurement.',
                    'period_info': period_label
                })

        product_tags[pid] = tags

    # Upsert generated alerts into smart_alerts table, preserving is_read and is_dismissed
    for a in alerts_to_upsert:
        cur.execute('''
            INSERT INTO smart_alerts (
                alert_key, alert_type, priority, category, product_id, product_name,
                current_stock, threshold, recent_units_sold, previous_units_sold,
                sales_velocity, trend_percentage, recommended_priority, suggested_reorder_qty,
                title, message, action_recommendation, period_info, updated_at
            ) VALUES (
                :alert_key, :alert_type, :priority, :category, :product_id, :product_name,
                :current_stock, :threshold, :recent_units_sold, :previous_units_sold,
                :sales_velocity, :trend_percentage, :recommended_priority, :suggested_reorder_qty,
                :title, :message, :action_recommendation, :period_info, CURRENT_TIMESTAMP
            )
            ON CONFLICT(alert_key) DO UPDATE SET
                priority = excluded.priority,
                category = excluded.category,
                current_stock = excluded.current_stock,
                threshold = excluded.threshold,
                recent_units_sold = excluded.recent_units_sold,
                previous_units_sold = excluded.previous_units_sold,
                sales_velocity = excluded.sales_velocity,
                trend_percentage = excluded.trend_percentage,
                recommended_priority = excluded.recommended_priority,
                suggested_reorder_qty = excluded.suggested_reorder_qty,
                title = excluded.title,
                message = excluded.message,
                action_recommendation = excluded.action_recommendation,
                period_info = excluded.period_info,
                updated_at = CURRENT_TIMESTAMP
        ''', a)

    # Clean up obsolete alerts
    if active_keys:
        placeholders = ','.join('?' for _ in active_keys)
        cur.execute(f'DELETE FROM smart_alerts WHERE alert_key NOT IN ({placeholders})', list(active_keys))
    else:
        cur.execute('DELETE FROM smart_alerts')
    conn.commit()

    # Query active non-dismissed alerts
    cur.execute('''
        SELECT id, alert_key, alert_type, priority, category, product_id, product_name,
               current_stock, threshold, recent_units_sold, previous_units_sold,
               sales_velocity, trend_percentage, recommended_priority, suggested_reorder_qty,
               title, message, action_recommendation, period_info,
               is_read, is_dismissed, created_at, updated_at
        FROM smart_alerts
        WHERE is_dismissed = 0
        ORDER BY 
            CASE priority 
                WHEN 'CRITICAL' THEN 1 
                WHEN 'HIGH' THEN 2 
                ELSE 3 
            END ASC,
            id DESC
    ''')
    alert_rows = [dict(r) for r in cur.fetchall()]
    for a in alert_rows:
        a['is_read'] = bool(a['is_read'])
        a['is_dismissed'] = bool(a['is_dismissed'])

    unread_count = sum(1 for a in alert_rows if not a['is_read'])
    critical_count = sum(1 for a in alert_rows if a['priority'] == 'CRITICAL')
    attention_count = sum(1 for a in alert_rows if a['category'] == 'attention')
    insight_count = sum(1 for a in alert_rows if a['category'] == 'insight')

    output = {
        'success': True,
        'alerts': alert_rows,
        'unread_count': unread_count,
        'summary': {
            'critical_count': critical_count,
            'attention_count': attention_count,
            'insight_count': insight_count,
            'total_active': len(alert_rows)
        },
        'product_alert_tags': product_tags,
        'settings': {
            'analysis_period_days': period_days,
            'high_demand_threshold_pct': high_demand_pct,
            'slow_moving_threshold_pct': slow_moving_pct,
            'min_sales_for_trend': int(cfg.get('min_sales_for_trend') or 1),
            'enable_stock_alerts': enable_stock,
            'enable_sales_trend_alerts': enable_trends,
            'critical_stock_ratio': crit_ratio
        }
    }
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e), 'alerts': [], 'unread_count': 0}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/alerts error:", err);
      res.status(500).json({ success: false, error: err.message, alerts: [], unread_count: 0 });
    }
  });

  // POST: Mark an alert as read
  app.post("/api/alerts/:id/read", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Alert ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

alert_id = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute("UPDATE smart_alerts SET is_read = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (alert_id,))
    conn.commit()
    print(json.dumps({'success': True, 'message': 'Alert marked as read.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Mark all alerts as read
  app.post("/api/alerts/mark-all-read", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute("UPDATE smart_alerts SET is_read = 1, updated_at = CURRENT_TIMESTAMP WHERE is_dismissed = 0")
    conn.commit()
    print(json.dumps({'success': True, 'message': 'All alerts marked as read.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Dismiss an alert
  app.delete("/api/alerts/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid Alert ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

alert_id = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute("UPDATE smart_alerts SET is_dismissed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (alert_id,))
    conn.commit()
    print(json.dumps({'success': True, 'message': 'Alert dismissed successfully.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET: Fetch alert settings
  app.get("/api/alerts/settings", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("SELECT * FROM alert_settings WHERE id = 1")
    row = cur.fetchone()
    if row:
        cfg = dict(row)
        cfg['enable_stock_alerts'] = bool(cfg['enable_stock_alerts'])
        cfg['enable_sales_trend_alerts'] = bool(cfg['enable_sales_trend_alerts'])
        print(json.dumps({'success': True, 'settings': cfg}))
    else:
        print(json.dumps({'success': False, 'error': 'Settings not found'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Update alert settings
  app.post("/api/alerts/settings", async (req, res) => {
    const {
      analysis_period_days,
      high_demand_threshold_pct,
      slow_moving_threshold_pct,
      enable_stock_alerts,
      enable_sales_trend_alerts,
      critical_stock_ratio
    } = req.body || {};

    const payload = {
      analysis_period_days: parseInt(analysis_period_days, 10) || 7,
      high_demand_threshold_pct: parseFloat(high_demand_threshold_pct) || 40.0,
      slow_moving_threshold_pct: parseFloat(slow_moving_threshold_pct) || -40.0,
      enable_stock_alerts: enable_stock_alerts !== false ? 1 : 0,
      enable_sales_trend_alerts: enable_sales_trend_alerts !== false ? 1 : 0,
      critical_stock_ratio: parseFloat(critical_stock_ratio) || 0.5
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute("""
        UPDATE alert_settings
        SET analysis_period_days = ?,
            high_demand_threshold_pct = ?,
            slow_moving_threshold_pct = ?,
            enable_stock_alerts = ?,
            enable_sales_trend_alerts = ?,
            critical_stock_ratio = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (
        args['analysis_period_days'],
        args['high_demand_threshold_pct'],
        args['slow_moving_threshold_pct'],
        args['enable_stock_alerts'],
        args['enable_sales_trend_alerts'],
        args['critical_stock_ratio']
    ))
    conn.commit()
    print(json.dumps({'success': True, 'message': 'Alert settings updated successfully.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= PHASE 2: SMART REORDER PREDICTION API =================
  app.get("/api/reorder-predictions", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, datetime, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

today = datetime.date.today()
start_14 = today - datetime.timedelta(days=14)

try:
    cur.execute('''
        WITH sales_14 AS (
            SELECT COALESCE(si.product_id, p.id) as pid, SUM(si.quantity) as qty
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            WHERE date(s.sale_date) >= date(?)
            GROUP BY COALESCE(si.product_id, p.id)
        ),
        sales_30 AS (
            SELECT COALESCE(si.product_id, p.id) as pid, SUM(si.quantity) as qty
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            WHERE date(s.sale_date) >= date(?)
            GROUP BY COALESCE(si.product_id, p.id)
        )
        SELECT p.id, p.name, p.sku, p.category, p.stock_quantity, p.min_stock_level, p.price,
               COALESCE(p.purchase_price, ROUND(p.price * 0.65, 2)) as cost,
               COALESCE(p.supplier, '') as supplier,
               COALESCE(s14.qty, 0) as units_14,
               COALESCE(s30.qty, 0) as units_30
        FROM products p
        LEFT JOIN sales_14 s14 ON p.id = s14.pid
        LEFT JOIN sales_30 s30 ON p.id = s30.pid
        ORDER BY p.id ASC
    ''', (start_14.isoformat(), (today - datetime.timedelta(days=30)).isoformat()))

    products = cur.fetchall()
    predictions = []
    total_reorder_cost = 0.0
    high_count = 0
    medium_count = 0

    for p in products:
        stock = p['stock_quantity'] or 0
        min_lvl = p['min_stock_level'] or 5
        cost = p['cost'] or 0.0
        u14 = p['units_14'] or 0
        velocity = round(u14 / 14.0, 2)

        if velocity > 0:
            days_out = int(round(stock / velocity))
        else:
            days_out = 999 if stock > 0 else 0

        # Suggested reorder quantity
        needed_buffer = max(min_lvl * 2, int(round(velocity * 14)) + min_lvl - stock)
        suggested_qty = max(min_lvl, needed_buffer) if stock <= min_lvl or days_out <= 7 else 0

        # Priority
        if stock <= 0 or (velocity > 0 and days_out <= 4) or stock <= 2:
            priority = 'High'
            high_count += 1
        elif stock <= min_lvl or (velocity > 0 and days_out <= 10):
            priority = 'Medium'
            medium_count += 1
        else:
            priority = 'Low'

        est_cost = round(suggested_qty * cost, 2)
        if suggested_qty > 0 and priority in ['High', 'Medium']:
            total_reorder_cost += est_cost

        # Status text
        if stock <= 0:
            status_text = 'Stockout Now'
        elif days_out <= 4:
            status_text = f'Stockout in ~{days_out} days'
        elif days_out <= 10:
            status_text = f'Runout in ~{days_out} days'
        elif days_out < 999:
            status_text = f'Buffer for {days_out} days'
        else:
            status_text = 'Stable stock'

        predictions.append({
            'product_id': p['id'],
            'product_name': p['name'],
            'sku': p['sku'] or '',
            'category': p['category'] or 'General',
            'current_stock': stock,
            'min_stock_level': min_lvl,
            'unit_cost': cost,
            'selling_price': p['price'],
            'supplier': p['supplier'] or 'General Vendor',
            'sales_velocity_per_day': velocity,
            'units_sold_14d': u14,
            'units_sold_30d': p['units_30'] or 0,
            'days_until_stockout': days_out,
            'status_text': status_text,
            'priority': priority,
            'suggested_reorder_qty': suggested_qty,
            'estimated_reorder_cost': est_cost,
            'estimated_lead_days': 4
        })

    # Sort so High priority is at the top
    prio_order = {'High': 0, 'Medium': 1, 'Low': 2}
    predictions.sort(key=lambda x: (prio_order.get(x['priority'], 3), x['days_until_stockout']))

    print(json.dumps({
        'success': True,
        'predictions': predictions,
        'summary': {
            'total_analyzed': len(predictions),
            'high_priority_count': high_count,
            'medium_priority_count': medium_count,
            'total_reorder_budget_needed': round(total_reorder_cost, 2),
            'analysis_date': today.isoformat()
        }
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e), 'predictions': []}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/reorder-predictions error:", err);
      res.status(500).json({ success: false, error: err.message, predictions: [] });
    }
  });

  // ================= PHASE 3: DEAD STOCK RECOVERY API =================
  app.get("/api/dead-stock", async (req, res) => {
    const daysParam = parseInt(req.query.days as string, 10) || 30;
    const pythonScript = `
import sqlite3, json, datetime, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

today = datetime.date.today()
threshold_days = int(${daysParam})
cutoff_date = today - datetime.timedelta(days=threshold_days)

try:
    cur.execute('''
        WITH last_sale AS (
            SELECT COALESCE(si.product_id, p.id) as pid, MAX(s.sale_date) as last_date, SUM(si.quantity) as total_sold
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            GROUP BY COALESCE(si.product_id, p.id)
        ),
        actions_logged AS (
            SELECT product_id, action_taken, discount_pct, notes, created_at
            FROM dead_stock_actions
            ORDER BY id DESC
        )
        SELECT p.id, p.name, p.sku, p.category, p.stock_quantity, p.min_stock_level, p.price,
               COALESCE(p.purchase_price, ROUND(p.price * 0.65, 2)) as cost,
               COALESCE(p.supplier, '') as supplier,
               ls.last_date,
               COALESCE(ls.total_sold, 0) as total_sold
        FROM products p
        LEFT JOIN last_sale ls ON p.id = ls.pid
        WHERE p.stock_quantity > 0 AND (ls.last_date IS NULL OR date(ls.last_date) <= date(?))
        ORDER BY (p.stock_quantity * COALESCE(p.purchase_price, ROUND(p.price * 0.65, 2))) DESC
    ''', (cutoff_date.isoformat(),))

    rows = cur.fetchall()
    dead_items = []
    total_tied_capital = 0.0

    # Fetch recent logged actions
    cur.execute("SELECT product_id, action_taken, discount_pct, notes, created_at FROM dead_stock_actions ORDER BY id DESC")
    all_actions = cur.fetchall()
    action_map = {}
    for act in all_actions:
        pid = act['product_id']
        if pid not in action_map:
            action_map[pid] = []
        action_map[pid].append(dict(act))

    for r in rows:
        stock = r['stock_quantity'] or 0
        cost = r['cost'] or 0.0
        price = r['price'] or 0.0
        tied_up = round(stock * cost, 2)
        total_tied_capital += tied_up
        last_d = r['last_date']

        if last_d:
            try:
                dt = datetime.date.fromisoformat(last_d[:10])
                days_dormant = (today - dt).days
            except:
                days_dormant = threshold_days
        else:
            days_dormant = 90

        margin_pct = round(((price - cost) / max(0.01, price)) * 100, 1)

        # Practical recovery suggestions
        strategies = []
        if margin_pct >= 25:
            rec_disc = min(20, int(margin_pct - 10))
            strategies.append(f"Clearance Discount: Mark down by {rec_disc}% (Preserves ~{margin_pct - rec_disc}% margin)")
        if stock >= 15:
            strategies.append("Combo Bundling: Pair with high-selling item as a bundle deal")
        strategies.append(f"Liquidation Priority: Free up ₹{tied_up:,.2f} trapped working capital")
        strategies.append("Halt Procurement: Do not create vendor purchase orders until cleared")

        dead_items.append({
            'product_id': r['id'],
            'product_name': r['name'],
            'sku': r['sku'] or '',
            'category': r['category'] or 'General',
            'stock_quantity': stock,
            'unit_cost': cost,
            'selling_price': price,
            'margin_pct': margin_pct,
            'tied_up_capital': tied_up,
            'days_dormant': days_dormant,
            'last_sale_date': last_d or 'No Recorded Sales',
            'total_lifetime_sold': r['total_sold'],
            'supplier': r['supplier'] or 'Vendor',
            'suggested_strategies': strategies,
            'logged_actions': action_map.get(r['id'], [])
        })

    print(json.dumps({
        'success': True,
        'dead_stock_items': dead_items,
        'summary': {
            'threshold_days': threshold_days,
            'total_dead_products': len(dead_items),
            'total_tied_up_capital': round(total_tied_capital, 2),
            'total_dormant_units': sum(d['stock_quantity'] for d in dead_items)
        }
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e), 'dead_stock_items': []}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/dead-stock error:", err);
      res.status(500).json({ success: false, error: err.message, dead_stock_items: [] });
    }
  });

  // POST: Record dead stock recovery action
  app.post("/api/dead-stock/action", async (req, res) => {
    const { product_id, action_taken, discount_pct, notes } = req.body || {};
    if (!product_id || !action_taken) {
      return res.status(400).json({ success: false, error: "Product ID and action taken are required." });
    }

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute('''
        INSERT INTO dead_stock_actions (product_id, action_taken, discount_pct, notes)
        VALUES (?, ?, ?, ?)
    ''', (
        args['product_id'],
        args['action_taken'],
        float(args.get('discount_pct') or 0.0),
        args.get('notes') or ''
    ))
    conn.commit()
    print(json.dumps({'success': True, 'message': 'Dead stock recovery action recorded successfully.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify({ product_id, action_taken, discount_pct, notes })]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= PHASE 6: CUSTOMER RETENTION & REMINDERS API =================
  app.get("/api/customer-retention", async (req, res) => {
    const inactiveDays = parseInt(req.query.inactive_days as string, 10) || 30;
    const pythonScript = `
import sqlite3, json, datetime, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

today = datetime.date.today()
threshold = int(${inactiveDays})

try:
    cur.execute('''
        SELECT id, name, phone, email, total_purchases, total_orders, paid_amount, pending_amount, last_purchase_date
        FROM customers
        ORDER BY total_purchases DESC
    ''')
    customers = cur.fetchall()

    # Get all active reminders
    cur.execute('''
        SELECT id, customer_id, reminder_note, due_date, priority, status, created_at
        FROM customer_reminders
        WHERE status != 'Completed'
        ORDER BY due_date ASC
    ''')
    reminders = [dict(r) for r in cur.fetchall()]
    reminder_map = {}
    for r in reminders:
        cid = r['customer_id']
        if cid not in reminder_map:
            reminder_map[cid] = []
        reminder_map[cid].append(r)

    retention_list = []
    at_risk_count = 0
    needs_followup_count = 0
    total_pending_collections = 0.0

    for c in customers:
        cid = c['id']
        name = c['name']
        spent = float(c['total_purchases'] or 0.0)
        orders = int(c['total_orders'] or 0)
        pending = float(c['pending_amount'] or 0.0)
        last_d = c['last_purchase_date']

        total_pending_collections += pending

        if last_d:
            try:
                dt = datetime.date.fromisoformat(last_d[:10])
                days_inactive = (today - dt).days
            except:
                days_inactive = 45
        else:
            days_inactive = 60

        # Classification
        if days_inactive >= 60:
            status = 'at_risk'
            status_label = 'At-Risk (Inactive > 60d)'
            at_risk_count += 1
        elif days_inactive >= threshold or pending > 0:
            status = 'needs_followup'
            status_label = 'Needs Follow-Up'
            needs_followup_count += 1
        else:
            status = 'active'
            status_label = 'Active Regular'

        # Tailored recommendation
        if pending > 0:
            rec_strategy = f'Payment Follow-Up: Pending balance of ₹{pending:,.2f}. Send polite payment statement.'
        elif spent >= 15000 and days_inactive >= 30:
            rec_strategy = f'High-Value Re-engagement: VIP client (Lifetime: ₹{spent:,.2f}). Make personal courtesy call with special discount.'
        elif days_inactive >= 60:
            rec_strategy = 'Win-Back Promotion: Send seasonal catalog or "We miss you" comeback coupon.'
        else:
            rec_strategy = 'Relationship Care: Share new arrivals and check satisfaction on previous orders.'

        retention_list.append({
            'customer_id': cid,
            'name': name,
            'phone': c['phone'] or '',
            'email': c['email'] or '',
            'total_purchases': spent,
            'total_orders': orders,
            'pending_amount': pending,
            'last_purchase_date': last_d or 'No purchases',
            'days_inactive': days_inactive,
            'status': status,
            'status_label': status_label,
            'recommended_strategy': rec_strategy,
            'active_reminders': reminder_map.get(cid, [])
        })

    # Sort so customers needing follow-up and highest spend appear first
    retention_list.sort(key=lambda x: (0 if x['pending_amount'] > 0 else (1 if x['status'] == 'at_risk' else 2), -x['total_purchases']))

    print(json.dumps({
        'success': True,
        'customers': retention_list,
        'summary': {
            'total_customers': len(retention_list),
            'at_risk_count': at_risk_count,
            'needs_followup_count': needs_followup_count,
            'total_pending_receivables': round(total_pending_collections, 2),
            'active_reminders_count': len(reminders)
        }
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e), 'customers': []}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/customer-retention error:", err);
      res.status(500).json({ success: false, error: err.message, customers: [] });
    }
  });

  // POST: Create customer follow-up reminder
  app.post("/api/customer-reminders", async (req, res) => {
    const { customer_id, reminder_note, due_date, priority } = req.body || {};
    if (!customer_id || !reminder_note) {
      return res.status(400).json({ success: false, error: "Customer ID and reminder note are required." });
    }

    const pythonScript = `
import sqlite3, json, sys, os, datetime

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute('''
        INSERT INTO customer_reminders (customer_id, reminder_note, due_date, priority, status)
        VALUES (?, ?, ?, ?, 'Pending')
    ''', (
        args['customer_id'],
        args['reminder_note'],
        args.get('due_date') or datetime.date.today().isoformat(),
        args.get('priority') or 'Medium'
    ))
    conn.commit()
    rem_id = cur.lastrowid
    print(json.dumps({'success': True, 'id': rem_id, 'message': 'Follow-up reminder scheduled successfully.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify({ customer_id, reminder_note, due_date, priority })]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Update customer reminder
  app.put("/api/customer-reminders/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status, reminder_note, due_date } = req.body || {};
    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute('''
        UPDATE customer_reminders
        SET status = COALESCE(?, status),
            reminder_note = COALESCE(?, reminder_note),
            due_date = COALESCE(?, due_date),
            completed_at = CASE WHEN ? = 'Completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = ?
    ''', (args.get('status'), args.get('reminder_note'), args.get('due_date'), args.get('status'), args['id']))
    conn.commit()
    print(json.dumps({'success': True, 'message': 'Reminder updated.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify({ id, status, reminder_note, due_date })]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Delete customer reminder
  app.delete("/api/customer-reminders/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()
try:
    cur.execute('DELETE FROM customer_reminders WHERE id = ?', (int(${id}),))
    conn.commit()
    print(json.dumps({'success': True, 'message': 'Reminder deleted.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= TODAY'S BUSINESS ACTIONS AGGREGATOR =================
  app.get("/api/business-actions", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, datetime, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

today = datetime.date.today()
today_str = today.isoformat()

try:
    actions = []

    # 1. Critical Out of Stock or Low Stock Restock Actions
    cur.execute('''
        SELECT id, name, sku, stock_quantity, min_stock_level, price, COALESCE(supplier, '') as supplier
        FROM products
        WHERE stock_quantity <= min_stock_level
        ORDER BY stock_quantity ASC
        LIMIT 4
    ''')
    for p in cur.fetchall():
        is_out = p['stock_quantity'] <= 0
        actions.append({
            'id': f"restock_{p['id']}",
            'type': 'restock',
            'priority': 'Critical' if is_out else 'High',
            'title': f"{'🔴 Out of Stock' if is_out else '⚠️ Low Stock'}: {p['name']}",
            'description': f"Current stock is {p['stock_quantity']} units (Minimum: {p['min_stock_level']}). Reorder recommended to avoid lost sales.",
            'product_id': p['id'],
            'product_name': p['name'],
            'suggested_qty': max(p['min_stock_level'] * 2, 10),
            'action_label': 'Restock Product',
            'action_target': 'inventory',
            'created_at': today_str
        })

    # 2. Dead Stock Capital Recovery
    cutoff_30 = today - datetime.timedelta(days=30)
    cur.execute('''
        WITH last_sale AS (
            SELECT COALESCE(si.product_id, p.id) as pid, MAX(s.sale_date) as last_date
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
            GROUP BY COALESCE(si.product_id, p.id)
        )
        SELECT p.id, p.name, p.stock_quantity, p.price,
               COALESCE(p.purchase_price, ROUND(p.price * 0.65, 2)) as cost
        FROM products p
        LEFT JOIN last_sale ls ON p.id = ls.pid
        WHERE p.stock_quantity >= 5 AND (ls.last_date IS NULL OR date(ls.last_date) <= date(?))
        ORDER BY (p.stock_quantity * COALESCE(p.purchase_price, ROUND(p.price * 0.65, 2))) DESC
        LIMIT 2
    ''', (cutoff_30.isoformat(),))
    for ds in cur.fetchall():
        tied = round((ds['stock_quantity'] or 0) * (ds['cost'] or 0), 2)
        actions.append({
            'id': f"deadstock_{ds['id']}",
            'type': 'dead_stock',
            'priority': 'Medium',
            'title': f"📉 Dead Stock Recovery: {ds['name']}",
            'description': f"Holds ₹{tied:,.2f} in tied-up capital with no recent sales. Consider applying a 15-20% clearance discount or promotional bundle.",
            'product_id': ds['id'],
            'product_name': ds['name'],
            'action_label': 'Review Dead Stock',
            'action_target': 'dead_stock',
            'created_at': today_str
        })

    # 3. Customer Retention & Payment Reminders
    cur.execute('''
        SELECT id, name, phone, pending_amount, total_purchases
        FROM customers
        WHERE pending_amount > 0
        ORDER BY pending_amount DESC
        LIMIT 2
    ''')
    for cust in cur.fetchall():
        actions.append({
            'id': f"cust_pending_{cust['id']}",
            'type': 'customer_followup',
            'priority': 'High',
            'title': f"💳 Pending Receivable: {cust['name']}",
            'description': f"Customer has an outstanding balance of ₹{cust['pending_amount']:,.2f}. Follow up to settle invoice and improve cash flow.",
            'customer_id': cust['id'],
            'customer_name': cust['name'],
            'pending_amount': cust['pending_amount'],
            'action_label': 'Follow Up Client',
            'action_target': 'customers',
            'created_at': today_str
        })

    # 4. Unusual Expense or High Outlay Review
    cur.execute('''
        SELECT id, title, amount, category, expense_date
        FROM expenses
        WHERE amount >= 5000
        ORDER BY date(expense_date) DESC, amount DESC
        LIMIT 1
    ''')
    top_exp = cur.fetchone()
    if top_exp:
        actions.append({
            'id': f"exp_{top_exp['id']}",
            'type': 'expense_review',
            'priority': 'Medium',
            'title': f"💸 Significant Outlay: {top_exp['title']}",
            'description': f"Recorded ₹{top_exp['amount']:,.2f} under {top_exp['category']}. Audit receipts and verify vendor billing terms.",
            'action_label': 'Review Expenses',
            'action_target': 'expenses',
            'created_at': today_str
        })

    print(json.dumps({
        'success': True,
        'actions': actions,
        'summary': {
            'total_actions': len(actions),
            'critical_count': sum(1 for a in actions if a['priority'] == 'Critical'),
            'high_count': sum(1 for a in actions if a['priority'] == 'High')
        }
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e), 'actions': []}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/business-actions error:", err);
      res.status(500).json({ success: false, error: err.message, actions: [] });
    }
  });

  // ================= PHASE 7: DAILY / WEEKLY / MONTHLY BUSINESS REPORT API =================
  app.get("/api/business-report", async (req, res) => {
    const period = (req.query.period as string) || "daily";
    const pythonScript = `
import sqlite3, json, datetime, os

period = '${period}'
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

today = datetime.date.today()
today_str = today.isoformat()

if period == 'weekly':
    start_date = today - datetime.timedelta(days=7)
    period_title = f"Weekly Business Report ({start_date.strftime('%b %d')} - {today.strftime('%b %d, %Y')})"
elif period == 'monthly':
    start_date = datetime.date(today.year, today.month, 1)
    period_title = f"Monthly Business Report ({today.strftime('%B %Y')})"
else:
    start_date = today
    period_title = f"Daily Business Report ({today.strftime('%A, %B %d, %Y')})"

start_str = start_date.isoformat()

try:
    # 1. Sales & Invoices in period
    cur.execute('''
        SELECT id, invoice_no, total_amount, paid_amount, pending_amount, customer_name, payment_method, payment_status, sale_date
        FROM sales
        WHERE date(sale_date) >= date(?) AND date(sale_date) <= date(?)
        ORDER BY date(sale_date) DESC, id DESC
    ''', (start_str, today_str))
    sales_rows = cur.fetchall()

    period_sales = round(sum(s['total_amount'] or 0.0 for s in sales_rows), 2)
    period_paid = round(sum(s['paid_amount'] or 0.0 for s in sales_rows), 2)
    period_pending = round(sum(s['pending_amount'] or 0.0 for s in sales_rows), 2)
    orders_count = len(sales_rows)
    aov = round(period_sales / max(1, orders_count), 2) if orders_count else 0.0

    # 2. Operating Expenses in period
    cur.execute('''
        SELECT id, title, amount, category, expense_date, payment_method
        FROM expenses
        WHERE date(expense_date) >= date(?) AND date(expense_date) <= date(?)
        ORDER BY amount DESC
    ''', (start_str, today_str))
    expense_rows = cur.fetchall()

    period_expenses = round(sum(e['amount'] or 0.0 for e in expense_rows), 2)
    exp_cats = {}
    for e in expense_rows:
        cat = e['category'] or 'General'
        exp_cats[cat] = round(exp_cats.get(cat, 0.0) + (e['amount'] or 0.0), 2)

    # 3. Estimated COGS & Profit in period
    cur.execute('''
        SELECT si.product_name, si.quantity, si.unit_price, si.total_price,
               COALESCE(p.purchase_price, ROUND(si.unit_price * 0.65, 2)) as unit_cost
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(p.name))
        WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
    ''', (start_str, today_str))
    sold_items = cur.fetchall()

    period_cogs = round(sum((it['quantity'] or 1) * (it['unit_cost'] or 0.0) for it in sold_items), 2)
    if period_cogs == 0 and period_sales > 0:
        period_cogs = round(period_sales * 0.65, 2)

    gross_profit = round(period_sales - period_cogs, 2)
    net_profit = round(gross_profit - period_expenses, 2)
    profit_margin = round((net_profit / period_sales * 100), 2) if period_sales > 0 else 0.0

    # 4. Top Selling Products in period
    top_products_map = {}
    for it in sold_items:
        pname = it['product_name']
        if pname not in top_products_map:
            top_products_map[pname] = {'name': pname, 'quantity': 0, 'revenue': 0.0}
        top_products_map[pname]['quantity'] += int(it['quantity'] or 0)
        top_products_map[pname]['revenue'] += float(it['total_price'] or 0.0)

    top_products = sorted(top_products_map.values(), key=lambda x: x['revenue'], reverse=True)[:5]
    for tp in top_products:
        tp['revenue'] = round(tp['revenue'], 2)

    # 5. Inventory Status Overview
    cur.execute("SELECT COUNT(*) FROM products WHERE stock_quantity <= 0")
    out_stock_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM products WHERE stock_quantity > 0 AND stock_quantity <= min_stock_level")
    low_stock_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM products")
    total_products = cur.fetchone()[0]

    # 6. Customer & Receivables Summary
    cur.execute("SELECT COUNT(DISTINCT customer_name) FROM sales WHERE date(sale_date) >= date(?) AND date(sale_date) <= date(?)", (start_str, today_str))
    active_customers = cur.fetchone()[0]
    cur.execute("SELECT SUM(pending_amount) FROM customers")
    total_receivables = round(cur.fetchone()[0] or 0.0, 2)

    # 7. Procurement in period
    cur.execute('''
        SELECT SUM(total_amount), COUNT(*) FROM supplier_purchases
        WHERE date(purchase_date) >= date(?) AND date(purchase_date) <= date(?)
    ''', (start_str, today_str))
    pur_row = cur.fetchone()
    period_procurement = round(pur_row[0] or 0.0, 2)
    procurement_orders = pur_row[1] or 0

    report = {
        'period': period,
        'title': period_title,
        'start_date': start_str,
        'end_date': today_str,
        'financials': {
            'sales_revenue': period_sales,
            'paid_revenue': period_paid,
            'pending_revenue': period_pending,
            'cogs': period_cogs,
            'gross_profit': gross_profit,
            'operating_expenses': period_expenses,
            'net_profit': net_profit,
            'profit_margin': profit_margin,
            'total_orders': orders_count,
            'average_order_value': aov
        },
        'expense_breakdown': [{'category': k, 'amount': v} for k, v in exp_cats.items()],
        'top_products': top_products,
        'inventory_health': {
            'total_catalog_products': total_products,
            'out_of_stock_count': out_stock_count,
            'low_stock_count': low_stock_count
        },
        'customer_summary': {
            'active_buyers_in_period': active_customers,
            'total_business_receivables': total_receivables
        },
        'procurement': {
            'total_spent': period_procurement,
            'purchase_orders_count': procurement_orders
        },
        'generated_at': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    print(json.dumps({'success': True, 'report': report}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/business-report error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= PHASE 8: OFFLINE-FIRST BATCH SYNC API =================
  app.post("/api/sync/batch", async (req, res) => {
    const { items = [] } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, processed_count: 0, duplicate_count: 0, items_synced: [] });
    }

    const pythonScript = `
import sqlite3, json, sys, os, datetime

args = json.loads(sys.argv[1])
batch_items = args.get('items', [])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

processed = 0
duplicates = 0
synced_ids = []

try:
    for item in batch_items:
        client_id = item.get('client_id')
        action_type = item.get('action_type')
        payload = item.get('payload', {})

        if not client_id or not action_type:
            continue

        # 1. Idempotency check: prevent duplicate submissions
        cur.execute('SELECT 1 FROM sync_idempotency WHERE client_id = ?', (client_id,))
        if cur.fetchone():
            duplicates += 1
            synced_ids.append({'client_id': client_id, 'status': 'duplicate_skipped'})
            continue

        # 2. Execute transaction based on action_type
        if action_type == 'sale':
            cust_name = payload.get('customer_name') or 'Direct Walk-in'
            tot = float(payload.get('total_amount') or 0.0)
            paid = float(payload.get('paid_amount') or tot)
            pending = max(0.0, tot - paid)
            inv_no = payload.get('invoice_no') or f"INV-OFF-{int(datetime.datetime.now().timestamp())}"
            s_date = payload.get('sale_date') or datetime.date.today().isoformat()
            pay_method = payload.get('payment_method') or 'Cash'
            pay_status = payload.get('payment_status') or ('Paid' if pending == 0 else 'Pending')

            cur.execute('''
                INSERT INTO sales (invoice_no, customer_name, total_amount, paid_amount, pending_amount, payment_method, payment_status, sale_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (inv_no, cust_name, tot, paid, pending, pay_method, pay_status, s_date))
            sale_id = cur.lastrowid

            # Process sale items & adjust stock
            for sit in payload.get('items', []):
                p_name = sit.get('product_name')
                qty = int(sit.get('quantity') or 1)
                u_price = float(sit.get('unit_price') or 0.0)
                tot_p = float(sit.get('total_price') or (qty * u_price))
                p_id = sit.get('product_id')

                cur.execute('''
                    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (sale_id, p_id, p_name, qty, u_price, tot_p))

                # Decrement stock if product found
                if p_id:
                    cur.execute('UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?', (qty, p_id))
                    cur.execute('''
                        INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
                        VALUES (?, 'SALE_OUT', ?, ?)
                    ''', (p_id, -qty, f"Offline Synced Sale: {inv_no}"))

            cur.execute('INSERT INTO sync_idempotency (client_id, action_type, record_id) VALUES (?, ?, ?)', (client_id, 'sale', sale_id))
            processed += 1
            synced_ids.append({'client_id': client_id, 'status': 'synced', 'record_id': sale_id})

        elif action_type == 'expense':
            title = payload.get('title') or 'Offline Expense'
            amt = float(payload.get('amount') or 0.0)
            cat = payload.get('category') or 'General'
            e_date = payload.get('expense_date') or datetime.date.today().isoformat()
            method = payload.get('payment_method') or 'Cash'
            desc = payload.get('description') or ''

            cur.execute('''
                INSERT INTO expenses (title, amount, category, expense_date, payment_method, description)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (title, amt, cat, e_date, method, desc))
            exp_id = cur.lastrowid
            cur.execute('INSERT INTO sync_idempotency (client_id, action_type, record_id) VALUES (?, ?, ?)', (client_id, 'expense', exp_id))
            processed += 1
            synced_ids.append({'client_id': client_id, 'status': 'synced', 'record_id': exp_id})

        elif action_type == 'adjust_stock':
            pid = payload.get('product_id')
            qty = int(payload.get('quantity') or 0)
            mode = payload.get('action_type') or 'add'
            notes = payload.get('notes') or 'Offline Adjustment'

            if pid:
                if mode == 'set':
                    cur.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', (max(0, qty), pid))
                elif mode == 'decrease':
                    cur.execute('UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?', (qty, pid))
                else:
                    cur.execute('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', (qty, pid))

                cur.execute('INSERT INTO stock_movements (product_id, movement_type, quantity, notes) VALUES (?, ?, ?, ?)',
                            (pid, 'ADJUSTMENT', qty, notes))
                cur.execute('INSERT INTO sync_idempotency (client_id, action_type, record_id) VALUES (?, ?, ?)', (client_id, 'adjust_stock', pid))
                processed += 1
                synced_ids.append({'client_id': client_id, 'status': 'synced', 'record_id': pid})

    conn.commit()
    print(json.dumps({
        'success': True,
        'processed_count': processed,
        'duplicate_count': duplicates,
        'items_synced': synced_ids
    }))
except Exception as e:
    conn.rollback()
    print(json.dumps({'success': False, 'error': str(e), 'processed_count': 0, 'duplicate_count': 0}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify({ items })]);
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/sync/batch error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= EMPLOYEES CRUD API (Requirement 14, 15) =================
  // GET: View all employees from SQLite database
  app.get("/api/employees", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    rows = cur.execute("""
        SELECT id, name, phone, email, role, department, salary, joining_date, status
        FROM employees
        ORDER BY id DESC
    """).fetchall()
    employees = [dict(r) for r in rows]
    for emp in employees:
        if not emp.get('phone'): emp['phone'] = ''
        if not emp.get('email'): emp['email'] = ''
        if not emp.get('joining_date'): emp['joining_date'] = ''
        if not emp.get('status'): emp['status'] = 'Active'
        if emp.get('salary') is None: emp['salary'] = 0.0
    print(json.dumps({'success': True, 'employees': employees}))
except Exception as e:
    print(json.dumps({'success': False, 'employees': [], 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/employees error:", err);
      res.status(500).json({ success: false, employees: [], error: err.message });
    }
  });

  // POST: Add new employee to SQLite database
  app.post("/api/employees", async (req, res) => {
    const { name, phone, email, role, department, salary, joining_date, status } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Employee Name is required." });
    }
    if (!role || !role.trim()) {
      return res.status(400).json({ success: false, error: "Job Role is required." });
    }

    const payload = {
      name: name.trim(),
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      role: role.trim(),
      department: department && department.trim() ? department.trim() : "General",
      salary: parseFloat(salary) || 0.0,
      joining_date: joining_date && joining_date.trim() ? joining_date.trim() : new Date().toISOString().split("T")[0],
      status: (status && (status === "Inactive" || status.toLowerCase() === "inactive")) ? "Inactive" : "Active"
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        INSERT INTO employees (name, phone, email, role, department, salary, joining_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        args['name'],
        args['phone'],
        args['email'],
        args['role'],
        args['department'],
        args['salary'],
        args['joining_date'],
        args['status']
    ))
    conn.commit()
    new_id = cur.lastrowid
    row = cur.execute("""
        SELECT id, name, phone, email, role, department, salary, joining_date, status
        FROM employees WHERE id = ?
    """, (new_id,)).fetchone()
    created = dict(row)
    print(json.dumps({'success': True, 'employee': created, 'message': f"Employee '{args['name']}' added successfully."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        return res.status(500).json({ success: false, error: data.error || "Failed to save employee to SQLite" });
      }
      res.json(data);
    } catch (err: any) {
      console.error("POST /api/employees error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT: Edit existing employee in SQLite database
  app.put("/api/employees/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid employee ID" });
    }

    const { name, phone, email, role, department, salary, joining_date, status } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Employee Name is required." });
    }
    if (!role || !role.trim()) {
      return res.status(400).json({ success: false, error: "Job Role is required." });
    }

    const payload = {
      id,
      name: name.trim(),
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      role: role.trim(),
      department: department && department.trim() ? department.trim() : "General",
      salary: parseFloat(salary) || 0.0,
      joining_date: joining_date && joining_date.trim() ? joining_date.trim() : new Date().toISOString().split("T")[0],
      status: (status && (status === "Inactive" || status.toLowerCase() === "inactive")) ? "Inactive" : "Active"
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        UPDATE employees
        SET name = ?, phone = ?, email = ?, role = ?, department = ?, salary = ?, joining_date = ?, status = ?
        WHERE id = ?
    """, (
        args['name'],
        args['phone'],
        args['email'],
        args['role'],
        args['department'],
        args['salary'],
        args['joining_date'],
        args['status'],
        args['id']
    ))
    conn.commit()
    if cur.rowcount == 0:
        print(json.dumps({'success': False, 'error': 'Employee not found in database', 'not_found': True}))
    else:
        row = cur.execute("""
            SELECT id, name, phone, email, role, department, salary, joining_date, status
            FROM employees WHERE id = ?
        """, (args['id'],)).fetchone()
        updated = dict(row)
        print(json.dumps({'success': True, 'employee': updated, 'message': f"Employee '{args['name']}' updated successfully."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      if (!data.success) {
        const statusCode = data.not_found ? 404 : 500;
        return res.status(statusCode).json({ success: false, error: data.error || "Failed to update employee" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`PUT /api/employees/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE: Remove employee from SQLite database
  app.delete("/api/employees/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid employee ID" });
    }

    const pythonScript = `
import sqlite3, json, sys, os

emp_id = int(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT name FROM employees WHERE id = ?", (emp_id,)).fetchone()
    emp_name = row['name'] if row else f"ID #{emp_id}"
    cur.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
    conn.commit()
    if cur.rowcount == 0:
        print(json.dumps({'success': False, 'error': 'Employee not found in database', 'not_found': True}))
    else:
        print(json.dumps({'success': True, 'message': f"Employee '{emp_name}' deleted permanently from SQLite."}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [id.toString()]);
      if (!data.success) {
        const statusCode = data.not_found ? 404 : 500;
        return res.status(statusCode).json({ success: false, error: data.error || "Failed to delete employee" });
      }
      res.json(data);
    } catch (err: any) {
      console.error(`DELETE /api/employees/${id} error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= AI BUSINESS ASSISTANT API =================
  // Helper to extract comprehensive business metrics and records for AI context
  const getBusinessDataSummary = async (): Promise<any> => {
    const pythonScript = `
import sqlite3, json, os, datetime

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def table_exists(tbl):
    return cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (tbl,)).fetchone() is not None

today = datetime.date.today()
today_str = today.isoformat()
yesterday = today - datetime.timedelta(days=1)
yesterday_str = yesterday.isoformat()

# 1. Products & Inventory
products = []
total_inventory_value = 0.0
low_stock_items = []
out_of_stock_items = []

if table_exists('products'):
    for p in cur.execute("SELECT id, name, category, sku, price, purchase_price, stock_quantity, min_stock_level FROM products ORDER BY id ASC").fetchall():
        price = float(p['price'] or 0.0)
        cost = float(p['purchase_price'] or 0.0)
        if cost <= 0 and price > 0:
            cost = round(price * 0.65, 2)
        stock = int(p['stock_quantity'] or 0)
        min_lvl = int(p['min_stock_level'] or 5)
        item_val = round(stock * cost, 2)
        total_inventory_value += item_val
        p_dict = {
            'id': p['id'],
            'name': p['name'],
            'category': p['category'] or 'General',
            'sku': p['sku'] or '',
            'price': price,
            'cost': cost,
            'stock': stock,
            'min_stock': min_lvl,
            'status': 'Out of Stock' if stock <= 0 else ('Low Stock' if stock <= min_lvl else 'In Stock')
        }
        products.append(p_dict)
        if stock <= 0:
            out_of_stock_items.append(p_dict)
        elif stock <= min_lvl:
            low_stock_items.append(p_dict)

total_inventory_value = round(total_inventory_value, 2)

# 2. Sales & Revenue
sales = []
total_sales = 0.0
paid_revenue = 0.0
pending_revenue = 0.0
product_sales_map = {}

if table_exists('sales'):
    for s in cur.execute("SELECT id, invoice_no, customer_name, customer_phone, product_name, quantity, total_amount, payment_method, payment_status, sale_date FROM sales ORDER BY date(sale_date) DESC, id DESC").fetchall():
        amt = float(s['total_amount'] or 0.0)
        total_sales += amt
        p_status = (s['payment_status'] or 'Paid').lower()
        if p_status == 'paid':
            paid_revenue += amt
        else:
            pending_revenue += amt
        sales.append({
            'id': s['id'],
            'invoice_no': s['invoice_no'] or f"INV-{s['id']}",
            'customer_name': s['customer_name'] or 'Walk-in Customer',
            'product_name': s['product_name'] or 'Item',
            'quantity': int(s['quantity'] or 1),
            'amount': amt,
            'payment_method': s['payment_method'] or 'Cash',
            'payment_status': s['payment_status'] or 'Paid',
            'sale_date': s['sale_date'] or today_str
        })

# Product performance from sale_items or sales
if table_exists('sale_items'):
    for it in cur.execute("SELECT product_name, SUM(quantity) as qty, SUM(total_price) as rev FROM sale_items GROUP BY product_name ORDER BY rev DESC").fetchall():
        pname = it['product_name']
        product_sales_map[pname] = {
            'name': pname,
            'units': int(it['qty'] or 0),
            'revenue': round(float(it['rev'] or 0.0), 2)
        }
elif sales:
    for s in sales:
        pname = s['product_name'] or 'Standard Item'
        if pname not in product_sales_map:
            product_sales_map[pname] = {'name': pname, 'units': 0, 'revenue': 0.0}
        product_sales_map[pname]['units'] += s['quantity']
        product_sales_map[pname]['revenue'] = round(product_sales_map[pname]['revenue'] + s['amount'], 2)

top_selling_products = sorted(list(product_sales_map.values()), key=lambda x: x['revenue'], reverse=True)
fast_selling = sorted(list(product_sales_map.values()), key=lambda x: x['units'], reverse=True)

# Daily sales aggregation
daily_sales_map = {}
for s in sales:
    sdate = s['sale_date']
    if sdate not in daily_sales_map:
        daily_sales_map[sdate] = {'date': sdate, 'total': 0.0, 'orders': 0}
    daily_sales_map[sdate]['total'] = round(daily_sales_map[sdate]['total'] + s['amount'], 2)
    daily_sales_map[sdate]['orders'] += 1
daily_sales_history = sorted(list(daily_sales_map.values()), key=lambda x: x['date'], reverse=True)

sales_today = [s for s in sales if s['sale_date'] == today_str]
today_sales = round(sum(s['amount'] for s in sales_today), 2)
today_orders = len(sales_today)

sales_yesterday = [s for s in sales if s['sale_date'] == yesterday_str]
yesterday_sales = round(sum(s['amount'] for s in sales_yesterday), 2)
yesterday_orders = len(sales_yesterday)

most_recent_sale_day = daily_sales_history[0] if daily_sales_history else {'date': today_str, 'total': 0.0, 'orders': 0}

# Slow moving products (in catalog with stock > 0 and 0 or lowest units sold)
slow_moving = []
for p in products:
    sold_units = product_sales_map.get(p['name'], {}).get('units', 0)
    if p['stock'] > 0 and sold_units <= 1:
        slow_moving.append({
            'id': p['id'],
            'name': p['name'],
            'stock': p['stock'],
            'price': p['price'],
            'units_sold': sold_units,
            'category': p['category']
        })
slow_moving = sorted(slow_moving, key=lambda x: (x['units_sold'], -x['stock']))[:5]

# 3. Expenses
expenses = []
total_expenses = 0.0
expense_categories = {}

if table_exists('expenses'):
    for e in cur.execute("SELECT id, title, category, amount, expense_date, payment_method, description FROM expenses ORDER BY date(expense_date) DESC, id DESC").fetchall():
        amt = float(e['amount'] or 0.0)
        total_expenses += amt
        cat = e['category'] or 'General'
        expense_categories[cat] = round(expense_categories.get(cat, 0.0) + amt, 2)
        expenses.append({
            'id': e['id'],
            'title': e['title'] or e['description'] or 'Expense',
            'category': cat,
            'amount': amt,
            'date': e['expense_date'] or today_str,
            'payment_method': e['payment_method'] or 'UPI'
        })

total_expenses = round(total_expenses, 2)
total_sales = round(total_sales, 2)
paid_revenue = round(paid_revenue, 2)
pending_revenue = round(pending_revenue, 2)

# Today expenses & profit calculation
expenses_today = [e for e in expenses if e['date'] == today_str]
today_expenses = round(sum(e['amount'] for e in expenses_today), 2)
today_cogs = round(today_sales * 0.65, 2)
today_gross_profit = round(today_sales - today_cogs, 2)
today_net_profit = round(today_gross_profit - today_expenses, 2)

# Estimate Overall COGS & Profit
total_cogs = 0.0
if table_exists('sale_items'):
    for it in cur.execute("SELECT product_name, quantity, unit_price FROM sale_items").fetchall():
        p_name = it['product_name']
        matching_prod = next((p for p in products if p['name'].lower() == (p_name or '').lower()), None)
        u_cost = matching_prod['cost'] if matching_prod else round(float(it['unit_price'] or 0.0) * 0.65, 2)
        total_cogs += round(int(it['quantity'] or 1) * u_cost, 2)
else:
    total_cogs = round(total_sales * 0.65, 2)

gross_profit = round(total_sales - total_cogs, 2)
net_profit = round(gross_profit - total_expenses, 2)
profit_margin = round((net_profit / total_sales * 100), 2) if total_sales > 0 else 0.0

# Detect Unusual or High Expenses
avg_expense = round(total_expenses / max(1, len(expenses)), 2) if expenses else 0.0
unusual_expenses = []
for exp in expenses:
    reasons = []
    if exp['amount'] >= 10000:
        reasons.append("High single expenditure (>= ₹10,000)")
    if avg_expense > 0 and exp['amount'] >= (avg_expense * 2.0):
        reasons.append(f"Exceeds 2x average expense of ₹{avg_expense:,.2f}")
    if exp['category'] in ['Rent', 'Marketing', 'Stock Purchase'] and exp['amount'] >= 5000:
        reasons.append(f"Significant outlay in {exp['category']}")
    if reasons:
        unusual_expenses.append({
            'id': exp['id'],
            'title': exp['title'],
            'category': exp['category'],
            'amount': exp['amount'],
            'date': exp['date'],
            'reason': " & ".join(reasons)
        })

# 4. Customers
customers = []
top_customers = []
if table_exists('customers'):
    for c in cur.execute("SELECT id, name, phone, email, total_purchases, total_orders, paid_amount, pending_amount, last_purchase_date FROM customers ORDER BY total_purchases DESC").fetchall():
        cust = {
            'id': c['id'],
            'name': c['name'],
            'phone': c['phone'] or '',
            'total_purchases': float(c['total_purchases'] or 0.0),
            'total_orders': int(c['total_orders'] or 0),
            'paid_amount': float(c['paid_amount'] or 0.0),
            'pending_amount': float(c['pending_amount'] or 0.0),
            'last_purchase_date': c['last_purchase_date'] or ''
        }
        customers.append(cust)
    top_customers = customers[:5]

customers_by_orders = sorted(customers, key=lambda x: x['total_orders'], reverse=True)[:5]

# 5. Suppliers & Vendor Procurement
suppliers = []
top_suppliers = []
suppliers_count = 0
total_procurement = 0.0
recent_purchases = []
top_procured_products = []

if table_exists('suppliers'):
    suppliers_count = cur.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]
    for sup in cur.execute("SELECT id, name, company_name, mobile, email, total_purchases, last_purchase_date FROM suppliers ORDER BY total_purchases DESC").fetchall():
        sup_dict = {
            'id': sup['id'],
            'name': sup['name'],
            'company_name': sup['company_name'] or '',
            'mobile': sup['mobile'] or '',
            'email': sup['email'] or '',
            'total_purchases': float(sup['total_purchases'] or 0.0),
            'last_purchase_date': sup['last_purchase_date'] or ''
        }
        suppliers.append(sup_dict)
    top_suppliers = suppliers[:5]

if table_exists('supplier_purchases'):
    for pur in cur.execute("SELECT p.id, p.invoice_no, p.supplier_id, p.product_name, p.quantity, p.unit_cost, p.total_amount, p.purchase_date, p.payment_status, s.name as supplier_name, s.company_name as supplier_company FROM supplier_purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id ORDER BY date(p.purchase_date) DESC, p.id DESC LIMIT 10").fetchall():
        p_amt = float(pur['total_amount'] or 0.0)
        total_procurement += p_amt
        recent_purchases.append({
            'id': pur['id'],
            'invoice_no': pur['invoice_no'] or f"PO-{pur['id']}",
            'supplier_name': pur['supplier_name'] or pur['supplier_company'] or 'Vendor',
            'product_name': pur['product_name'] or 'Stock',
            'quantity': int(pur['quantity'] or 0),
            'unit_cost': float(pur['unit_cost'] or 0.0),
            'total_amount': p_amt,
            'purchase_date': pur['purchase_date'] or today_str,
            'payment_status': pur['payment_status'] or 'Paid'
        })

    supplier_prod_map = {}
    for po in cur.execute("SELECT product_name, SUM(quantity) as qty, SUM(total_amount) as spent FROM supplier_purchases GROUP BY product_name ORDER BY spent DESC").fetchall():
        supplier_prod_map[po['product_name']] = {
            'product_name': po['product_name'],
            'quantity': int(po['qty'] or 0),
            'spent': round(float(po['spent'] or 0.0), 2)
        }
    top_procured_products = list(supplier_prod_map.values())[:5]

employees_count = cur.execute("SELECT COUNT(*) FROM employees").fetchone()[0] if table_exists('employees') else 0

active_smart_alerts = []
if table_exists('smart_alerts'):
    for a in cur.execute("SELECT id, alert_type, priority, category, product_name, current_stock, threshold, recent_units_sold, trend_percentage, title, message, action_recommendation FROM smart_alerts WHERE is_dismissed = 0 ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END ASC, id DESC").fetchall():
        active_smart_alerts.append({
            'id': a['id'],
            'alert_type': a['alert_type'],
            'priority': a['priority'],
            'category': a['category'],
            'product_name': a['product_name'],
            'current_stock': int(a['current_stock'] or 0),
            'threshold': int(a['threshold'] or 0),
            'recent_units_sold': int(a['recent_units_sold'] or 0),
            'trend_percentage': float(a['trend_percentage'] or 0.0),
            'title': a['title'],
            'message': a['message'],
            'action_recommendation': a['action_recommendation']
        })

result = {
    'overview': {
        'totalSales': total_sales,
        'paidRevenue': paid_revenue,
        'pendingRevenue': pending_revenue,
        'totalCogs': total_cogs,
        'grossProfit': gross_profit,
        'totalExpenses': total_expenses,
        'netProfit': net_profit,
        'profitMargin': profit_margin,
        'totalOrders': len(sales),
        'avgOrderValue': round(total_sales / max(1, len(sales)), 2) if sales else 0.0,
        'totalCustomers': len(customers),
        'totalProducts': len(products),
        'inventoryValue': total_inventory_value,
        'totalEmployees': employees_count
    },
    'today': {
        'todayDate': today_str,
        'todaySales': today_sales,
        'todayOrders': today_orders,
        'todayExpenses': today_expenses,
        'todayGrossProfit': today_gross_profit,
        'todayNetProfit': today_net_profit,
        'yesterdayDate': yesterday_str,
        'yesterdaySales': yesterday_sales,
        'yesterdayOrders': yesterday_orders,
        'mostRecentSaleDate': most_recent_sale_day['date'],
        'mostRecentSaleAmount': most_recent_sale_day['total'],
        'mostRecentSaleOrders': most_recent_sale_day['orders'],
        'dailySalesHistory': daily_sales_history[:7]
    },
    'inventory': {
        'totalProducts': len(products),
        'lowStockCount': len(low_stock_items),
        'outOfStockCount': len(out_of_stock_items),
        'lowStockItems': low_stock_items,
        'outOfStockItems': out_of_stock_items,
        'slowMovingItems': slow_moving,
        'allProducts': products[:20]
    },
    'sales': {
        'topProducts': top_selling_products[:10],
        'fastSelling': fast_selling[:5],
        'slowMoving': slow_moving,
        'recentSales': sales[:10],
        'dailyHistory': daily_sales_history[:10],
        'totalOrders': len(sales)
    },
    'expenses': {
        'categories': [{'category': k, 'amount': v} for k, v in expense_categories.items()],
        'totalExpenses': total_expenses,
        'recentExpenses': expenses[:10],
        'unusualExpenses': unusual_expenses[:8]
    },
    'customers': {
        'totalCount': len(customers),
        'topCustomers': top_customers,
        'frequentCustomers': customers_by_orders,
        'pendingReceivables': pending_revenue
    },
    'suppliers': {
        'count': suppliers_count,
        'totalPurchases': round(total_procurement, 2),
        'topSuppliers': top_suppliers,
        'recentPurchases': recent_purchases,
        'topProcuredProducts': top_procured_products,
        'allSuppliers': suppliers
    },
    'alerts': {
        'totalCount': len(active_smart_alerts),
        'criticalCount': len([a for a in active_smart_alerts if a['priority'] == 'CRITICAL']),
        'activeAlerts': active_smart_alerts
    }
}

conn.close()
print(json.dumps(result))
`;
    return await runPythonSqliteQuery(pythonScript);
  };

  // Rule-based analytical fallback when Gemini API key is missing or quota/transient errors occur
  const generateRuleBasedAnswer = (userMessage: string, summary: any): string => {
    const rawQ = userMessage.trim();
    const q = rawQ.toLowerCase();
    const isHindi = /[\u0900-\u097F]/.test(rawQ);
    const isHinglish = !isHindi && /\b(aaj|aajki|meri|mera|mere|kitna|kitni|kitne|bika|bik|bikne|kam|zyada|jyada|kharch|kharcha|kya|kyu|kaun|kaise|grahak|maal|munafa|fayda|dukan|vyapar|khareed|kharidari|bataye|batao|kripya)\b/i.test(rawQ);

    const ov = summary.overview || {};
    const today = summary.today || {};
    const inv = summary.inventory || {};
    const sls = summary.sales || {};
    const exp = summary.expenses || {};
    const cust = summary.customers || {};
    const sup = summary.suppliers || {};
    const alr = summary.alerts || {};

    const formatINR = (val: number) => (Number(val) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

    // 0. SMART INVENTORY & SALES ALERTS QUERY (Requirement 13)
    const isAlertsQuery =
      q.includes("alert") ||
      q.includes("notification") ||
      q.includes("attention") ||
      q.includes("fast selling") ||
      q.includes("selling fast") ||
      q.includes("demand") ||
      q.includes("surge") ||
      q.includes("slow moving") ||
      (isHindi && (q.includes("अलर्ट") || q.includes("नोटिफिकेशन") || q.includes("ध्यान") || q.includes("चेतावनी") || q.includes("जल्दी बिक") || q.includes("तेज बिक") || q.includes("धीमी बिक"))) ||
      (isHinglish && (q.includes("alert") || q.includes("dhyan") || q.includes("urgent") || q.includes("fast selling") || q.includes("slow moving")));

    if (isAlertsQuery) {
      const activeList = alr.activeAlerts || [];
      const critCount = alr.criticalCount || 0;

      if (isHindi) {
        let ans = `### 🔔 स्मार्ट इन्वेंटरी एवं सेल्स अलर्ट्स (Smart Alerts)\n\n`;
        ans += `वर्तमान में सिस्टम में **${activeList.length} सक्रिय अलर्ट्स** (${critCount} क्रिटिकल) दर्ज हैं:\n\n`;

        if (activeList.length === 0) {
          ans += `✅ सभी इन्वेंटरी स्टॉक्स और सेल्स ट्रेंड्स सामान्य स्थिति में हैं। कोई भी क्रिटिकल अलर्ट नहीं है।\n`;
        } else {
          activeList.forEach((a: any, idx: number) => {
            const prioBadge = a.priority === "CRITICAL" ? "🔴 [CRITICAL]" : a.priority === "HIGH" ? "🟠 [HIGH]" : "🔵 [INSIGHT]";
            ans += `${idx + 1}. **${prioBadge} ${a.title}**\n`;
            ans += `   • वर्तमान स्टॉक: **${a.current_stock} यूनिट्स** (न्यूनतम सीमा: ${a.threshold})\n`;
            if (a.recent_units_sold > 0) {
              ans += `   • हालिया बिक्री: **${a.recent_units_sold} यूनिट्स**\n`;
            }
            ans += `   • **सिफारिश (Action):** ${a.action_recommendation}\n\n`;
          });
        }

        ans += `💡 **बिजनेस सलाह:** डैशबोर्ड के 'Smart Alerts Center' में जाकर आप सीधे क्विक रीऑर्डर कर सकते हैं या अलर्ट सेटिंग्स बदल सकते हैं।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 🔔 Live Smart Inventory & Sales Alerts\n\n`;
        ans += `Aapke store me abhi **${activeList.length} active alerts** (${critCount} critical) hain:\n\n`;

        if (activeList.length === 0) {
          ans += `✅ Saari inventory stock levels aur sales velocity normal hain. Koi urgent alert nahi hai.\n`;
        } else {
          activeList.forEach((a: any, idx: number) => {
            const prioBadge = a.priority === "CRITICAL" ? "🔴 [CRITICAL]" : a.priority === "HIGH" ? "🟠 [HIGH]" : "🔵 [INSIGHT]";
            ans += `${idx + 1}. **${prioBadge} ${a.title}**\n`;
            ans += `   • Stock: **${a.current_stock}** (Min threshold: ${a.threshold})\n`;
            if (a.recent_units_sold > 0) {
              ans += `   • Recent Sales: **${a.recent_units_sold} units**\n`;
            }
            ans += `   • **Action:** ${a.action_recommendation}\n\n`;
          });
        }

        ans += `💡 **Recommendation:** Dashboard par Smart Alerts Center use karke instant restock karein aur alert preferences customize karein.`;
        return ans;
      }

      // English
      let ans = `### 🔔 Smart Inventory & Sales Alerts Overview\n\n`;
      ans += `Currently tracking **${activeList.length} active business alerts** (${critCount} critical):\n\n`;

      if (activeList.length === 0) {
        ans += `✅ All catalog product stock quantities, reorder points, and sales velocity metrics are healthy.\n`;
      } else {
        activeList.forEach((a: any, idx: number) => {
          const prioBadge = a.priority === "CRITICAL" ? "🔴 [CRITICAL]" : a.priority === "HIGH" ? "🟠 [HIGH]" : "🔵 [INSIGHT]";
          ans += `${idx + 1}. **${prioBadge} ${a.title}**\n`;
          ans += `   • Current Stock: **${a.current_stock} units** (Min Level: ${a.threshold})\n`;
          if (a.recent_units_sold > 0) {
            ans += `   • Recent Sales Velocity: **${a.recent_units_sold} units sold**\n`;
          }
          ans += `   • **Recommended Action:** ${a.action_recommendation}\n\n`;
        });
      }

      ans += `💡 **Advisory:** Access the Smart Dashboard Alert Center to execute quick restocks or configure custom threshold sensitivity.`;
      return ans;
    }

    // 1. BUSINESS SUMMARY & TODAY'S METRICS
    const isTodayQuery =
      q.includes("today") ||
      q.includes("summary") ||
      q.includes("overview") ||
      q.includes("hisab") ||
      q.includes("performance") ||
      q.includes("aaj") ||
      isHindi && (q.includes("आज") || q.includes("समरी") || q.includes("हिसाब") || q.includes("सारांश") || q.includes("बिक्री हुई") || q.includes("सेल कितनी")) ||
      isHinglish && (q.includes("aaj") || q.includes("kitni hui") || q.includes("kitna bika") || q.includes("hisab"));

    if (isTodayQuery && !q.includes("expense jyada") && !q.includes("kharcha jyada") && !q.includes("profit low")) {
      const todaySales = today.todaySales || 0;
      const todayOrders = today.todayOrders || 0;
      const todayExpenses = today.todayExpenses || 0;
      const todayNetProfit = today.todayNetProfit || 0;
      const totalProducts = inv.totalProducts || ov.totalProducts || 0;
      const lowStockCount = (inv.lowStockCount || 0) + (inv.outOfStockCount || 0);
      const totalCustomers = cust.totalCount || ov.totalCustomers || 0;
      const recentSalesList = (sls.recentSales || []).slice(0, 4);

      if (isHindi) {
        let ans = `### 📊 आज का बिजनेस सारांश (${today.todayDate || "आज"})\n\n`;
        ans += `यहाँ आपके डेटाबेस रिकॉर्ड्स पर आधारित वास्तविक बिजनेस आंकड़े हैं:\n\n`;
        ans += `• **आज की कुल बिक्री (Today's Sales):** ₹${formatINR(todaySales)} (${todayOrders} ऑर्डर्स)\n`;
        ans += `• **आज का कुल खर्च (Today's Expenses):** ₹${formatINR(todayExpenses)}\n`;
        ans += `• **आज का शुद्ध मुनाफा (Today's Net Profit):** ₹${formatINR(todayNetProfit)}\n`;
        ans += `• **कुल प्रोडक्ट्स (Total Catalog Products):** ${totalProducts} प्रोडक्ट्स (इन्वेंटरी मूल्य: ₹${formatINR(ov.inventoryValue || 0)})\n`;
        ans += `• **कम स्टॉक वाले प्रोडक्ट्स (Low-Stock Alerts):** ${lowStockCount} प्रोडक्ट्स (${inv.outOfStockCount || 0} आउट ऑफ स्टॉक)\n`;
        ans += `• **कुल ग्राहक (Total Customers):** ${totalCustomers} ग्राहक (उधार/पेंडिंग: ₹${formatINR(ov.pendingRevenue || 0)})\n\n`;

        if (todaySales === 0 && today.mostRecentSaleDate) {
          ans += `ℹ️ *नोट:* आज अभी तक कोई नया ऑर्डर रिकॉर्ड नहीं हुआ है। पिछली बिक्री **${today.mostRecentSaleDate}** को **₹${formatINR(today.mostRecentSaleAmount || 0)}** (${today.mostRecentSaleOrders || 0} ऑर्डर्स) दर्ज की गई थी।\n\n`;
        }

        if (recentSalesList.length > 0) {
          ans += `🛍️ **हाल के ऑर्डर्स (Recent Sales):**\n`;
          recentSalesList.forEach((s: any) => {
            ans += `• **${s.invoice_no}** — ${s.customer_name} | ₹${formatINR(s.amount)} (${s.payment_method} - ${s.payment_status})\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **बिजनेस सलाह:**\n`;
        if (lowStockCount > 0) {
          ans += `1. **स्टॉक रीऑर्डर:** ${lowStockCount} प्रोडक्ट्स का स्टॉक तुरंत रीऑर्डर करें ताकि बिक्री में बाधा न आए।\n`;
        }
        ans += `2. **उधार वसूली:** ग्राहकों के ₹${formatINR(ov.pendingRevenue || 0)} पेंडिंग इनवॉइस फॉलो-अप करें।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 📊 Aaj Ka Business Summary (${today.todayDate || "Today"})\n\n`;
        ans += `Aapke live database records ke mutabik business summary:\n\n`;
        ans += `• **Aaj Ki Sales:** ₹${formatINR(todaySales)} (${todayOrders} orders)\n`;
        ans += `• **Aaj Ka Kharcha (Expenses):** ₹${formatINR(todayExpenses)}\n`;
        ans += `• **Aaj Ka Net Profit:** ₹${formatINR(todayNetProfit)}\n`;
        ans += `• **Total Products:** ${totalProducts} items (Inventory value: ₹${formatINR(ov.inventoryValue || 0)})\n`;
        ans += `• **Low-Stock Alerts:** ${lowStockCount} products (${inv.outOfStockCount || 0} out of stock)\n`;
        ans += `• **Total Customers:** ${totalCustomers} registered buyers\n\n`;

        if (todaySales === 0 && today.mostRecentSaleDate) {
          ans += `ℹ️ *Note:* Aaj abhi tak koi order add nahi hua hai. Last active sale date **${today.mostRecentSaleDate}** ko **₹${formatINR(today.mostRecentSaleAmount || 0)}** (${today.mostRecentSaleOrders || 0} orders) hui thi.\n\n`;
        }

        if (recentSalesList.length > 0) {
          ans += `🛍️ **Recent Sales Transactions:**\n`;
          recentSalesList.forEach((s: any) => {
            ans += `• **${s.invoice_no}** — ${s.customer_name} | ₹${formatINR(s.amount)} (${s.payment_method} - ${s.payment_status})\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **Actionable Business Suggestion:**\n`;
        ans += `• Fast-moving items ka stock check karein aur pending customer payments (₹${formatINR(ov.pendingRevenue || 0)}) ka follow-up karein.`;
        return ans;
      }

      // English Business Summary
      let ans = `### 📊 Executive Business Summary (${today.todayDate || "Today"})\n\n`;
      ans += `Here is your current operational breakdown derived from real database records:\n\n`;
      ans += `• **Today's Sales:** ₹${formatINR(todaySales)} across **${todayOrders} orders**\n`;
      ans += `• **Today's Expenses:** ₹${formatINR(todayExpenses)}\n`;
      ans += `• **Today's Net Profit:** ₹${formatINR(todayNetProfit)}\n`;
      ans += `• **Total Products:** ${totalProducts} catalog items (Inventory Value: ₹${formatINR(ov.inventoryValue || 0)})\n`;
      ans += `• **Low-Stock Alerts:** ${lowStockCount} products requiring replenishment\n`;
      ans += `• **Total Registered Customers:** ${totalCustomers} buyers\n`;
      ans += `• **Total Cumulative Sales:** ₹${formatINR(ov.totalSales || 0)} across ${ov.totalOrders || 0} orders\n\n`;

      if (todaySales === 0 && today.mostRecentSaleDate) {
        ans += `ℹ️ *Note:* No sales have been created for today yet. Previous active sales date was **${today.mostRecentSaleDate}** with **₹${formatINR(today.mostRecentSaleAmount || 0)}** across ${today.mostRecentSaleOrders || 0} orders.\n\n`;
      }

      if (recentSalesList.length > 0) {
        ans += `🛍️ **Recent Sales Orders:**\n`;
        recentSalesList.forEach((s: any) => {
          ans += `• **${s.invoice_no}** — ${s.customer_name} | ₹${formatINR(s.amount)} (${s.payment_method}, Status: ${s.payment_status})\n`;
        });
        ans += `\n`;
      }

      ans += `💡 **Immediate Strategic Actions:**\n`;
      ans += `1. **Inventory:** Reorder critical low-stock items to prevent stockouts.\n`;
      ans += `2. **Working Capital:** Collect ₹${formatINR(ov.pendingRevenue || 0)} in outstanding customer receivables.\n`;
      ans += `3. **Profit Margins:** Promote high-margin bundles to keep operating margin strong.`;
      return ans;
    }

    // 2. INVENTORY INTELLIGENCE & STOCK
    const isInventoryQuery =
      q.includes("stock") ||
      q.includes("inventory") ||
      q.includes("restock") ||
      q.includes("reorder") ||
      q.includes("slow") ||
      q.includes("fast") ||
      isHindi && (q.includes("स्टॉक") || q.includes("इन्वेंटरी") || q.includes("माल") || q.includes("कम है") || q.includes("खत्म")) ||
      isHinglish && (q.includes("stock kam") || q.includes("khatam") || q.includes("restock") || q.includes("slow moving"));

    if (isInventoryQuery && !q.includes("supplier") && !q.includes("vendor")) {
      const outOfStock = inv.outOfStockItems || [];
      const lowStock = inv.lowStockItems || [];
      const slowMoving = inv.slowMovingItems || [];
      const fastSelling = sls.fastSelling || [];

      if (isHindi) {
        let ans = `### 📦 इन्वेंटरी एवं स्टॉक रिपोर्ट (Inventory Intelligence)\n\n`;
        ans += `आपकी इन्वेंटरी में कुल **${inv.totalProducts || 0} प्रोडक्ट्स** हैं, जिनका कुल मूल्य **₹${formatINR(ov.inventoryValue || 0)}** है।\n\n`;

        if (outOfStock.length > 0) {
          ans += `🔴 **आउट-ऑफ-स्टॉक प्रोडक्ट्स (तुरंत रीऑर्डर करें):**\n`;
          outOfStock.forEach((i: any) => {
            ans += `• **${i.name}** — **0 स्टॉक** (न्यूनतम आवश्यक स्तर: ${i.min_stock}) | कीमत: ₹${formatINR(i.price)}\n`;
          });
          ans += `\n`;
        }

        if (lowStock.length > 0) {
          ans += `⚠️ **कम स्टॉक वाले प्रोडक्ट्स (Low Stock):**\n`;
          lowStock.forEach((i: any) => {
            ans += `• **${i.name}** — सिर्फ **${i.stock} यूनिट्स बची हैं** (मिनिमम लेवल: ${i.min_stock}) | खरीद लागत: ₹${formatINR(i.cost)}\n`;
          });
          ans += `\n`;
        }

        if (fastSelling.length > 0) {
          ans += `⚡ **तेजी से बिकने वाले प्रोडक्ट्स (Fast-Moving):**\n`;
          fastSelling.slice(0, 3).forEach((f: any) => {
            ans += `• **${f.name}** — ${f.units} यूनिट्स बिकीं (रेवेन्यू: ₹${formatINR(f.revenue)})\n`;
          });
          ans += `\n`;
        }

        if (slowMoving.length > 0) {
          ans += `🐢 **धीमी गति से बिकने वाले प्रोडक्ट्स (Slow-Moving):**\n`;
          slowMoving.slice(0, 3).forEach((s: any) => {
            ans += `• **${s.name}** — स्टॉक में ${s.stock} यूनिट्स मौजूद हैं, लेकिन सिर्फ ${s.units_sold} बिक्री हुई है।\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **रीस्टॉक सिफारिशें:**\n`;
        ans += `• ${outOfStock.length + lowStock.length} चिन्हित प्रोडक्ट्स के लिए सप्लायर को परचेज ऑर्डर तुरंत जारी करें ताकि बिक्री में कोई रुकावट न आए।\n`;
        ans += `• धीमी गति से बिकने वाले सामान को लोकप्रिय सामान के साथ बंडल बनाकर क्लियर करें।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 📦 Inventory & Stock Status Analysis\n\n`;
        ans += `Aapke catalog me **${inv.totalProducts || 0} products** hain jinki total value **₹${formatINR(ov.inventoryValue || 0)}** hai.\n\n`;

        if (outOfStock.length > 0) {
          ans += `🔴 **Out-of-Stock Items (Immediate Restock):**\n`;
          outOfStock.forEach((i: any) => {
            ans += `• **${i.name}** — Stock: 0 (Min Required: ${i.min_stock}) | Price: ₹${formatINR(i.price)}\n`;
          });
          ans += `\n`;
        }

        if (lowStock.length > 0) {
          ans += `⚠️ **Low-Stock Items:**\n`;
          lowStock.forEach((i: any) => {
            ans += `• **${i.name}** — Only **${i.stock} remaining** (Min: ${i.min_stock}) | Cost: ₹${formatINR(i.cost)}\n`;
          });
          ans += `\n`;
        }

        if (fastSelling.length > 0) {
          ans += `⚡ **Fast-Moving Products:**\n`;
          fastSelling.slice(0, 3).forEach((f: any) => {
            ans += `• **${f.name}** (${f.units} units sold, ₹${formatINR(f.revenue)})\n`;
          });
          ans += `\n`;
        }

        if (slowMoving.length > 0) {
          ans += `🐢 **Slow-Moving Stock:**\n`;
          slowMoving.slice(0, 3).forEach((s: any) => {
            ans += `• **${s.name}** (${s.stock} units in stock, ${s.units_sold} units sold)\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **Restock Recommendation:**\n`;
        ans += `• Urgent purchase orders issue karein out-of-stock items ke liye taaki demand miss na ho.`;
        return ans;
      }

      // English
      let ans = `### 📦 Inventory Intelligence & Stock Analysis\n\n`;
      ans += `Currently tracking **${inv.totalProducts || 0} catalog products** with a total valuation of **₹${formatINR(ov.inventoryValue || 0)}**.\n\n`;

      if (outOfStock.length > 0) {
        ans += `🔴 **Out-of-Stock Items (Immediate Action Needed):**\n`;
        outOfStock.forEach((i: any) => {
          ans += `• **${i.name}** — **0 units in stock** (Min threshold: ${i.min_stock}) | Selling Price: ₹${formatINR(i.price)}\n`;
        });
        ans += `\n`;
      }

      if (lowStock.length > 0) {
        ans += `⚠️ **Low-Stock Alerts:**\n`;
        lowStock.forEach((i: any) => {
          ans += `• **${i.name}** — **${i.stock} units left** (Min threshold: ${i.min_stock}) | Unit Cost: ₹${formatINR(i.cost)}\n`;
        });
        ans += `\n`;
      }

      if (fastSelling.length > 0) {
        ans += `⚡ **Fast-Moving Products (High Turnover):**\n`;
        fastSelling.slice(0, 3).forEach((f: any) => {
          ans += `• **${f.name}** — ${f.units} units sold (Revenue: ₹${formatINR(f.revenue)})\n`;
        });
        ans += `\n`;
      }

      if (slowMoving.length > 0) {
        ans += `🐢 **Slow-Moving Inventory (Capital Tied Up):**\n`;
        slowMoving.slice(0, 3).forEach((s: any) => {
          ans += `• **${s.name}** — ${s.stock} units in warehouse with only ${s.units_sold} units sold\n`;
        });
        ans += `\n`;
      }

      ans += `💡 **Inventory Optimization Plan:**\n`;
      ans += `1. **Order Replenishment:** Issue POs for ${outOfStock.length + lowStock.length} low/out-of-stock items immediately.\n`;
      ans += `2. **Liquidation:** Bundle slow-moving products with best-selling hardware to free up working capital.`;
      return ans;
    }

    // 3. PROFIT & EXPENSE ANALYSIS
    const isProfitExpenseQuery =
      q.includes("profit") ||
      q.includes("expense") ||
      q.includes("cost") ||
      q.includes("margin") ||
      q.includes("spending") ||
      q.includes("unusual") ||
      q.includes("p&l") ||
      q.includes("loss") ||
      isHindi && (q.includes("प्रॉफिट") || q.includes("मुनाफा") || q.includes("खर्च") || q.includes("लागत") || q.includes("फायदा") || q.includes("कम क्यों") || q.includes("ज्यादा क्यों")) ||
      isHinglish && (q.includes("profit") || q.includes("kharcha") || q.includes("kam kyu") || q.includes("jyada kyu") || q.includes("munafa") || q.includes("spending"));

    if (isProfitExpenseQuery) {
      const cats = exp.categories || [];
      const unusual = exp.unusualExpenses || [];
      const topCat = cats[0] || { category: "Operations", amount: 0 };

      if (isHindi) {
        let ans = `### 💰 प्रॉफिट एवं खर्च विश्लेषण (Profit & Expense Breakdown)\n\n`;
        ans += `आपके वास्तविक वित्तीय रिकॉर्ड्स का विवरण:\n\n`;
        ans += `• **कुल बिक्री (Gross Sales):** ₹${formatINR(ov.totalSales || 0)}\n`;
        ans += `• **सामान की लागत (COGS):** ₹${formatINR(ov.totalCogs || 0)}\n`;
        ans += `• **सकल लाभ (Gross Profit):** ₹${formatINR(ov.grossProfit || 0)}\n`;
        ans += `• **कुल ऑपरेटिंग खर्च (Total Expenses):** ₹${formatINR(ov.totalExpenses || 0)}\n`;
        ans += `• **शुद्ध लाभ (Net Profit):** **₹${formatINR(ov.netProfit || 0)}** (मार्जिन: **${ov.profitMargin || 0}%**)\n\n`;

        ans += `📊 **शीर्ष खर्च श्रेणियां (Expense Categories):**\n`;
        cats.forEach((c: any) => {
          ans += `• **${c.category}:** ₹${formatINR(c.amount)}\n`;
        });
        ans += `\n`;

        if (unusual.length > 0) {
          ans += `🚨 **चिन्हित बड़े या असामान्य खर्चे (Flagged High Expenses):**\n`;
          unusual.forEach((u: any) => {
            ans += `• **${u.title}** (${u.category}) — **₹${formatINR(u.amount)}** (${u.date})\n  *कारण:* ${u.reason}\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **प्रॉफिट बढ़ाने के सुझाव (Profit Improvement):**\n`;
        if ((ov.netProfit || 0) < 0) {
          ans += `• **खर्च नियंत्रण:** ऑपरेटिंग खर्च (₹${formatINR(ov.totalExpenses || 0)}) सकल लाभ से अधिक है। ${topCat.category} और अन्य ओवरहेड खर्चों की समीक्षा करें।\n`;
        }
        ans += `• **हाई मार्जिन प्रोडक्ट्स:** ज्यादा मुनाफे वाले प्रोडक्ट्स की बिक्री बढ़ाएं।\n`;
        ans += `• **उधार वसूली:** पेंडिंग ₹${formatINR(ov.pendingRevenue || 0)} जल्द से जल्द वसूल करें।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 💰 Profit & Expenses Breakdown\n\n`;
        ans += `Database ke financial figures:\n\n`;
        ans += `• **Total Sales:** ₹${formatINR(ov.totalSales || 0)}\n`;
        ans += `• **Cost of Goods Sold (COGS):** ₹${formatINR(ov.totalCogs || 0)}\n`;
        ans += `• **Gross Profit:** ₹${formatINR(ov.grossProfit || 0)}\n`;
        ans += `• **Total Expenses:** ₹${formatINR(ov.totalExpenses || 0)}\n`;
        ans += `• **Net Profit:** **₹${formatINR(ov.netProfit || 0)}** (${ov.profitMargin || 0}% margin)\n\n`;

        ans += `📊 **Category-wise Expenses:**\n`;
        cats.forEach((c: any) => {
          ans += `• **${c.category}:** ₹${formatINR(c.amount)}\n`;
        });
        ans += `\n`;

        if (unusual.length > 0) {
          ans += `🚨 **High / Unusual Expenses:**\n`;
          unusual.forEach((u: any) => {
            ans += `• **${u.title}** — ₹${formatINR(u.amount)} (${u.date}) [${u.reason}]\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **Suggestions:**\n`;
        ans += `• Highest expense category **${topCat.category}** (₹${formatINR(topCat.amount)}) par review karein.\n`;
        ans += `• High-margin accessories bundle karke AOV increase karein.`;
        return ans;
      }

      // English
      let ans = `### 💰 Profit & Expense In-Depth Analysis\n\n`;
      ans += `Financial breakdown computed from database entries:\n\n`;
      ans += `• **Gross Sales Revenue:** ₹${formatINR(ov.totalSales || 0)} across ${ov.totalOrders || 0} orders\n`;
      ans += `• **Cost of Goods Sold (COGS):** ₹${formatINR(ov.totalCogs || 0)}\n`;
      ans += `• **Gross Profit:** ₹${formatINR(ov.grossProfit || 0)}\n`;
      ans += `• **Total Operating Expenses:** ₹${formatINR(ov.totalExpenses || 0)}\n`;
      ans += `• **Net Profit:** **₹${formatINR(ov.netProfit || 0)}** (Net Margin: **${ov.profitMargin || 0}%**)\n\n`;

      ans += `📊 **Expenses by Category:**\n`;
      cats.forEach((c: any) => {
        ans += `• **${c.category}:** ₹${formatINR(c.amount)}\n`;
      });
      ans += `\n`;

      if (unusual.length > 0) {
        ans += `🚨 **Flagged High or Unusual Expenses:**\n`;
        unusual.forEach((u: any) => {
          ans += `• **${u.title}** (${u.category}) — **₹${formatINR(u.amount)}** on ${u.date}\n  *Flag reason:* ${u.reason}\n`;
        });
        ans += `\n`;
      }

      ans += `💡 **Profit Optimization Advice:**\n`;
      if ((ov.netProfit || 0) < 0) {
        ans += `1. **Overhead Control:** Total operating expenses exceed gross profits. Audit fixed outlays like ${topCat.category} (₹${formatINR(topCat.amount)}).\n`;
      } else {
        ans += `1. **Margin Expansion:** Protect positive margins by keeping fixed operational expenses capped below 35% of revenue.\n`;
      }
      ans += `2. **Receivables Inflow:** Accelerate collection of pending customer dues (₹${formatINR(ov.pendingRevenue || 0)}).`;
      return ans;
    }

    // 4. SUPPLIERS & PROCUREMENT
    const isSupplierQuery =
      q.includes("supplier") ||
      q.includes("vendor") ||
      q.includes("purchase") ||
      q.includes("procurement") ||
      q.includes("po") ||
      isHindi && (q.includes("सप्लायर") || q.includes("वेंडर") || q.includes("खरीद") || q.includes("खरीदारी") || q.includes("खरीदा")) ||
      isHinglish && (q.includes("supplier") || q.includes("vendor") || q.includes("kharidari") || q.includes("purchase"));

    if (isSupplierQuery) {
      const topSups = sup.topSuppliers || [];
      const recentPOs = sup.recentPurchases || [];
      const topProcured = sup.topProcuredProducts || [];

      if (isHindi) {
        let ans = `### 🚚 सप्लायर्स एवं खरीद रिपोर्ट (Supplier & Procurement Insights)\n\n`;
        ans += `आपके पास कुल **${sup.count || 0} पंजीकृत सप्लायर्स** हैं। कुल खरीद खर्च: **₹${formatINR(sup.totalPurchases || 0)}**।\n\n`;

        if (topSups.length > 0) {
          ans += `🏢 **शीर्ष सप्लायर्स (Top Suppliers by Volume):**\n`;
          topSups.forEach((s: any, idx: number) => {
            ans += `${idx + 1}. **${s.company_name || s.name}** — ₹${formatINR(s.total_purchases)} (${s.mobile || s.email || "सक्रिय"})\n`;
          });
          ans += `\n`;
        }

        if (topProcured.length > 0) {
          ans += `📦 **सबसे ज्यादा खरीदा गया सामान (Most Purchased Products):**\n`;
          topProcured.forEach((p: any) => {
            ans += `• **${p.product_name}** — ${p.quantity} यूनिट्स (कुल खर्च: ₹${formatINR(p.spent)})\n`;
          });
          ans += `\n`;
        }

        if (recentPOs.length > 0) {
          ans += `📋 **हाल के परचेज ऑर्डर्स (Recent Purchase Orders):**\n`;
          recentPOs.slice(0, 4).forEach((po: any) => {
            ans += `• **${po.product_name}** (${po.quantity} यूनिट्स, ₹${formatINR(po.total_amount)}) — ${po.supplier_name} [${po.purchase_date}]\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **खरीद रणनीति (Procurement Strategy):**\n`;
        ans += `• बड़े सप्लायर्स जैसे ${topSups[0]?.company_name || "मुख्य वेंडर्स"} से बल्क डिस्काउंट (5-10%) की बात करें।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 🚚 Supplier & Procurement Insights\n\n`;
        ans += `Total **${sup.count || 0} registered suppliers** ke sath **₹${formatINR(sup.totalPurchases || 0)}** ki procurement record hui hai.\n\n`;

        if (topSups.length > 0) {
          ans += `🏢 **Top Suppliers:**\n`;
          topSups.forEach((s: any, idx: number) => {
            ans += `${idx + 1}. **${s.company_name || s.name}** — ₹${formatINR(s.total_purchases)}\n`;
          });
          ans += `\n`;
        }

        if (topProcured.length > 0) {
          ans += `📦 **Most Purchased Items:**\n`;
          topProcured.forEach((p: any) => {
            ans += `• **${p.product_name}** (${p.quantity} units, ₹${formatINR(p.spent)})\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **Recommendation:** Top suppliers ke sath timely bulk orders place karein freight aur unit cost bachane ke liye.`;
        return ans;
      }

      // English
      let ans = `### 🚚 Supplier & Procurement Analytics\n\n`;
      ans += `Managing **${sup.count || 0} registered vendors** with **₹${formatINR(sup.totalPurchases || 0)}** in total tracked procurement.\n\n`;

      if (topSups.length > 0) {
        ans += `🏢 **Top Suppliers by Purchase Volume:**\n`;
        topSups.forEach((s: any, idx: number) => {
          ans += `${idx + 1}. **${s.company_name || s.name}** — ₹${formatINR(s.total_purchases)} (${s.mobile || "Active"})\n`;
        });
        ans += `\n`;
      }

      if (topProcured.length > 0) {
        ans += `📦 **Most Purchased Products from Vendors:**\n`;
        topProcured.forEach((p: any) => {
          ans += `• **${p.product_name}** — ${p.quantity} units acquired (Spent: ₹${formatINR(p.spent)})\n`;
        });
        ans += `\n`;
      }

      if (recentPOs.length > 0) {
        ans += `📋 **Recent Purchase Orders:**\n`;
        recentPOs.slice(0, 4).forEach((po: any) => {
          ans += `• **${po.product_name}** (${po.quantity} units, ₹${formatINR(po.total_amount)}) from ${po.supplier_name} on ${po.purchase_date} [Status: ${po.payment_status}]\n`;
        });
        ans += `\n`;
      }

      ans += `💡 **Procurement Advice:** Consolidate POs with primary vendors to secure better credit terms and volume rebates.`;
      return ans;
    }

    // 5. CUSTOMER INSIGHTS
    const isCustomerQuery =
      q.includes("customer") ||
      q.includes("client") ||
      q.includes("buyer") ||
      isHindi && (q.includes("ग्राहक") || q.includes("कस्टमर")) ||
      isHinglish && (q.includes("customer") || q.includes("grahak"));

    if (isCustomerQuery) {
      const topCust = cust.topCustomers || [];
      const frequent = cust.frequentCustomers || [];

      if (isHindi) {
        let ans = `### 👥 प्रमुख ग्राहक एवं खरीद ट्रेंड (Customer Insights)\n\n`;
        ans += `आपके पास **${cust.totalCount || 0} पंजीकृत ग्राहक** हैं। कुल बकाया उधार: **₹${formatINR(cust.pendingReceivables || 0)}**।\n\n`;

        if (topCust.length > 0) {
          ans += `🌟 **शीर्ष ग्राहक (Top Customers by Purchases):**\n`;
          topCust.forEach((c: any, idx: number) => {
            ans += `${idx + 1}. **${c.name}** — ₹${formatINR(c.total_purchases)} (${c.total_orders} ऑर्डर्स)`;
            if (c.pending_amount > 0) {
              ans += ` [बकाया: ₹${formatINR(c.pending_amount)}]`;
            }
            ans += `\n`;
          });
          ans += `\n`;
        }

        if (frequent.length > 0) {
          ans += `🔁 **अक्सर खरीदारी करने वाले ग्राहक (Frequent Buyers):**\n`;
          frequent.slice(0, 3).forEach((f: any) => {
            ans += `• **${f.name}** — ${f.total_orders} ऑर्डर्स (कुल ₹${formatINR(f.total_purchases)})\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **ग्राहक संबंध सुझाव:**\n`;
        ans += `• शीर्ष कॉर्पोरेट ग्राहकों (${topCust[0]?.name || "प्रमुख ग्राहक"}) को लॉयल्टी रिवॉर्ड्स ऑफर करें।\n`;
        ans += `• पेंडिंग पेमेंट्स वाले ग्राहकों को विनम्रतापूर्वक ऑटोमेटेड रिमाइंडर भेजें।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 👥 Top Customers & Insights\n\n`;
        ans += `Total **${cust.totalCount || 0} registered customers** hain. Pending receivables: **₹${formatINR(cust.pendingReceivables || 0)}**.\n\n`;

        if (topCust.length > 0) {
          ans += `🌟 **Top Spending Customers:**\n`;
          topCust.forEach((c: any, idx: number) => {
            ans += `${idx + 1}. **${c.name}** — ₹${formatINR(c.total_purchases)} (${c.total_orders} orders)\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **Retention Strategy:** Top buyers ke sath active relationship banayein aur timely credit payment follow karein.`;
        return ans;
      }

      // English
      let ans = `### 👥 Customer Insights & Loyalty\n\n`;
      ans += `Database registers **${cust.totalCount || 0} business customers** with **₹${formatINR(cust.pendingReceivables || 0)}** in pending receivables.\n\n`;

      if (topCust.length > 0) {
        ans += `🌟 **Top Customers by Lifetime Value:**\n`;
        topCust.forEach((c: any, idx: number) => {
          ans += `${idx + 1}. **${c.name}** — ₹${formatINR(c.total_purchases)} across ${c.total_orders} orders`;
          if (c.pending_amount > 0) {
            ans += ` [Pending: ₹${formatINR(c.pending_amount)}]`;
          }
          ans += `\n`;
        });
        ans += `\n`;
      }

      ans += `💡 **Customer Retention Tips:** Focus on VIP client relations and schedule payment reminders prior to the 30-day net mark.`;
      return ans;
    }

    // 6. SALES ANALYSIS & BEST SELLERS
    const isSalesQuery =
      q.includes("sale") ||
      q.includes("sell") ||
      q.includes("order") ||
      q.includes("product") ||
      q.includes("trend") ||
      isHindi && (q.includes("बिक्री") || q.includes("बिक रहा") || q.includes("सेल") || q.includes("सामान")) ||
      isHinglish && (q.includes("sale") || q.includes("bika") || q.includes("bik raha"));

    if (isSalesQuery) {
      const topProds = sls.topProducts || [];
      const dailyHistory = sls.dailyHistory || [];

      if (isHindi) {
        let ans = `### 📈 बिक्री विश्लेषण एवं टॉप प्रोडक्ट्स (Sales Analysis)\n\n`;
        ans += `• **कुल बिक्री:** ₹${formatINR(ov.totalSales || 0)} (${ov.totalOrders || 0} ऑर्डर्स)\n`;
        ans += `• **औसत ऑर्डर मूल्य (AOV):** ₹${formatINR(ov.avgOrderValue || 0)}\n`;
        ans += `• **प्राप्त राजस्व (Paid):** ₹${formatINR(ov.paidRevenue || 0)} | **पेंडिंग बकाया:** ₹${formatINR(ov.pendingRevenue || 0)}\n\n`;

        if (topProds.length > 0) {
          ans += `🏆 **सबसे ज्यादा बिकने वाले प्रोडक्ट्स (Best-Selling Products):**\n`;
          topProds.slice(0, 5).forEach((p: any, idx: number) => {
            ans += `${idx + 1}. **${p.name}** — ${p.units} यूनिट्स (कुल ₹${formatINR(p.revenue)})\n`;
          });
          ans += `\n`;
        }

        if (dailyHistory.length > 1) {
          ans += `📅 **दिन-वार बिक्री ट्रेंड (Daily Sales Trend):**\n`;
          dailyHistory.slice(0, 4).forEach((d: any) => {
            ans += `• **${d.date}:** ₹${formatINR(d.total)} (${d.orders} ऑर्डर्स)\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **बिक्री बढ़ाने के उपाय:**\n`;
        ans += `• बेस्ट सेलर आइटम (${topProds[0]?.name || "प्रोडक्ट"}) का स्टॉक हमेशा पर्याप्त रखें।\n`;
        ans += `• ग्राहकों को संबंधित एक्सेसरीज साथ में लेने का सुझाव दें।`;
        return ans;
      }

      if (isHinglish) {
        let ans = `### 📈 Sales Performance & Best Selling Products\n\n`;
        ans += `• **Total Revenue:** ₹${formatINR(ov.totalSales || 0)} (${ov.totalOrders || 0} orders)\n`;
        ans += `• **Average Order Value:** ₹${formatINR(ov.avgOrderValue || 0)}\n\n`;

        if (topProds.length > 0) {
          ans += `🏆 **Top Selling Products:**\n`;
          topProds.slice(0, 5).forEach((p: any, idx: number) => {
            ans += `${idx + 1}. **${p.name}** — ${p.units} units sold (₹${formatINR(p.revenue)})\n`;
          });
          ans += `\n`;
        }

        ans += `💡 **Sales Strategy:** Best-selling products ko fast restock karein aur related accessories cross-sell karein.`;
        return ans;
      }

      // English
      let ans = `### 📊 Sales Performance & Top Products Analysis\n\n`;
      ans += `• **Total Gross Sales:** ₹${formatINR(ov.totalSales || 0)} across **${ov.totalOrders || 0} orders**\n`;
      ans += `• **Average Order Value (AOV):** ₹${formatINR(ov.avgOrderValue || 0)}\n`;
      ans += `• **Settled Revenue:** ₹${formatINR(ov.paidRevenue || 0)} | **Pending Receivables:** ₹${formatINR(ov.pendingRevenue || 0)}\n\n`;

      if (topProds.length > 0) {
        ans += `🏆 **Best-Selling Products by Revenue:**\n`;
        topProds.slice(0, 5).forEach((p: any, idx: number) => {
          ans += `${idx + 1}. **${p.name}** — ${p.units} units sold (₹${formatINR(p.revenue)})\n`;
        });
        ans += `\n`;
      }

      if (dailyHistory.length > 1) {
        ans += `📅 **Recent Daily Sales Trend:**\n`;
        dailyHistory.slice(0, 4).forEach((d: any) => {
          ans += `• **${d.date}:** ₹${formatINR(d.total)} (${d.orders} orders)\n`;
        });
        ans += `\n`;
      }

      ans += `💡 **Sales Growth Advice:** Bundle top-selling hardware with high-margin consumables to lift AOV above ₹${formatINR(ov.avgOrderValue || 0)}.`;
      return ans;
    }

    // 7. DATA SAFETY / MISSING DATA / UNMATCHED QUERIES
    if (isHindi) {
      return `### ℹ️ जानकारी स्थिति\n\nइस जानकारी के लिए पर्याप्त data उपलब्ध नहीं है।\n\nआप निम्न में से कोई भी प्रश्न पूछ सकते हैं:\n• आज मेरी sale कितनी हुई?\n• मेरा profit कितना है?\n• कौन सा product सबसे ज्यादा बिक रहा है?\n• किस product का stock कम है?\n• मेरे top customers कौन हैं?\n• आज expense ज्यादा क्यों है?\n• मेरे top suppliers कौन हैं?`;
    }

    if (isHinglish) {
      return `### ℹ️ Data Availability Notice\n\nIs jankari ke liye aapke business database me paryapt data uplabdh nahi hai.\n\nAap ye questions pooch sakte hain:\n• Aaj meri sale kitni hui?\n• Mera profit kitna hai?\n• Kaun sa product sabse jyada bik raha hai?\n• Kis product ka stock kam hai?\n• Mere top customers kaun hain?\n• Top suppliers kaun hain?`;
    }

    return `### ℹ️ Information Notice\n\nThere is not enough data available in your business records for this query.\n\nYou can ask about real recorded database metrics such as:\n• Today's business summary\n• Best-selling products & sales trends\n• Profit & Loss breakdown and margins\n• Low-stock & out-of-stock inventory\n• Top spending customers\n• Top suppliers & procurement spend`;
  };

  // GET: Fetch real-time AI business context summary
  app.get("/api/ai-assistant/context", async (_req, res) => {
    try {
      const summary = await getBusinessDataSummary();
      res.json({ success: true, summary });
    } catch (err: any) {
      console.error("GET /api/ai-assistant/context error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET: Proactive AI Business Insights & Health Cards
  app.get("/api/ai-assistant/insights", async (_req, res) => {
    try {
      const summary = await getBusinessDataSummary();
      const ov = summary.overview || {};
      const inv = summary.inventory || {};
      const sls = summary.sales || {};
      const exp = summary.expenses || {};
      const cust = summary.customers || {};

      // Compute Financial Health Score (0-100)
      let healthScore = 70;
      if (ov.netProfit > 0) healthScore += 15;
      if (ov.profitMargin >= 20) healthScore += 10;
      if (inv.outOfStockCount === 0) healthScore += 5;
      else healthScore -= (inv.outOfStockCount * 4);
      if (ov.pendingRevenue > (ov.totalSales * 0.4)) healthScore -= 10;
      healthScore = Math.max(10, Math.min(100, healthScore));

      const insights = {
        healthScore,
        healthRating: healthScore >= 80 ? "Excellent" : (healthScore >= 60 ? "Good" : "Needs Attention"),
        overview: ov,
        today: summary.today,
        inventoryAlerts: {
          lowStockCount: inv.lowStockCount,
          outOfStockCount: inv.outOfStockCount,
          criticalItems: [...(inv.outOfStockItems || []), ...(inv.lowStockItems || [])].slice(0, 5),
          reorderSuggestedCount: (inv.outOfStockCount || 0) + (inv.lowStockCount || 0)
        },
        expenseWatchdog: {
          totalExpenses: exp.totalExpenses,
          unusualCount: (exp.unusualExpenses || []).length,
          unusualList: exp.unusualExpenses || [],
          topCategory: exp.categories?.[0] || { category: "General", amount: 0 }
        },
        salesHighlights: {
          totalSales: ov.totalSales,
          topProduct: sls.topProducts?.[0]?.name || "N/A",
          topProductRevenue: sls.topProducts?.[0]?.revenue || 0,
          pendingReceivables: ov.pendingRevenue
        },
        recommendations: [
          inv.outOfStockCount > 0
            ? `Restock ${inv.outOfStockCount} out-of-stock items (${inv.outOfStockItems.map((i: any) => i.name).join(", ")}) immediately to prevent lost sales.`
            : "Inventory stock levels are healthy; maintain reorder buffer before supplier lead times.",
          ov.pendingRevenue > 0
            ? `Collect ₹${(ov.pendingRevenue || 0).toLocaleString("en-IN")} in pending receivables to boost liquidity.`
            : "All customer sales are fully settled.",
          (exp.unusualExpenses || []).length > 0
            ? `Review ${exp.unusualExpenses.length} flagged expenses (including ${exp.unusualExpenses[0]?.title}) for cost optimization.`
            : "Operating expenses are distributed normally across business categories.",
          `Focus on upselling high-margin items like ${sls.topProducts?.[0]?.name || "hardware"} to expand your ${ov.profitMargin}% net margin.`
        ],
        suggestedQuestions: [
          "Today's Summary",
          "Sales Analysis",
          "Profit Analysis",
          "Low Stock",
          "Top Products",
          "Top Customers",
          "Top Suppliers"
        ]
      };

      res.json({ success: true, insights, summary });
    } catch (err: any) {
      console.error("GET /api/ai-assistant/insights error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST: Chat with AI Business Assistant (Gemini 3.8 Flash + SQLite Data)
  app.post("/api/ai-assistant/chat", async (req, res) => {
    try {
      const body = req.body || {};
      const rawMessage = body.message ?? body.userMessage ?? body.prompt ?? body.query ?? body.text ?? (typeof req.body === "string" ? req.body : undefined);

      if (rawMessage === undefined || rawMessage === null || typeof rawMessage !== "string" || !rawMessage.trim()) {
        return res.status(400).json({ success: false, error: "Message is required." });
      }

      const message = rawMessage.trim();
      const history = Array.isArray(body.history) ? body.history : [];

      const summary = await getBusinessDataSummary();
      const ov = summary.overview || {};
      const today = summary.today || {};
      const inv = summary.inventory || {};
      const sls = summary.sales || {};
      const exp = summary.expenses || {};
      const cust = summary.customers || {};
      const sup = summary.suppliers || {};

      const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

      if (hasApiKey) {
        try {
          const systemInstruction = `You are the Business AI Advisor for "Smart Business Manager", a professional business management and analytics application.
You act as an experienced, sharp, and helpful Chief Financial Officer (CFO), Operations Consultant, and Growth Advisor.

CRITICAL RESPONSIBILITIES & CONSTRAINTS:
1. STRICT DATA SAFETY: Use ONLY actual data retrieved from the application's database provided below. Never invent, extrapolate, or guess sales, expenses, inventory, products, customers, or profits.
2. If the user asks about data or metrics that are unavailable in the database records, clearly state:
   - In Hindi: "इस जानकारी के लिए पर्याप्त data उपलब्ध नहीं है।"
   - In English: "There is not enough data available in your business records for this query."
   - In Hinglish: "Is jankari ke liye aapke business database me paryapt data uplabdh nahi hai."
3. MULTI-LINGUAL SUPPORT:
   - Detect the user's language: English, Hindi (हिन्दी), or Hinglish.
   - If asked in Hindi (e.g. "आज मेरी sale कितनी हुई?", "मेरा profit कितना है?", "कौन सा product सबसे ज्यादा बिक रहा है?", "किस product का stock कम है?", "मेरे top customers कौन हैं?", "आज expense ज्यादा क्यों है?"), respond in clean, fluent Hindi using Devanagari script.
   - If asked in Hinglish (e.g. "aaj kitni sale hui", "mera profit kitna hai", "top customer kaun hai"), respond in natural, professional Hinglish.
   - If asked in English, respond in professional English.
4. STRUCTURED & READABLE FORMATTING:
   - Use clean Markdown headings (### Headings)
   - Use bullet points (• ) for all statistics and lists
   - Always use the Indian Rupee symbol (₹) formatted with thousands separators (e.g. ₹42,478.82)
   - Highlight key product names, dates, amounts, and figures in bold
   - Keep answers concise, highly scannable, and actionable.
5. BUSINESS ADVISORY:
   - Provide concrete, data-backed recommendations: restock alerts, cost reduction opportunities, top-seller bundling, customer credit follow-up, and procurement discounts.`;

          const liveContextText = `
=== CURRENT LIVE BUSINESS DATABASE METRICS ===
• Today's Date: ${today.todayDate || "Current Day"}
• Today's Sales: ₹${(today.todaySales || 0).toLocaleString('en-IN')} (${today.todayOrders || 0} orders)
• Today's Expenses: ₹${(today.todayExpenses || 0).toLocaleString('en-IN')}
• Today's Net Profit: ₹${(today.todayNetProfit || 0).toLocaleString('en-IN')}
• Yesterday's Date: ${today.yesterdayDate || "Previous Day"} | Yesterday's Sales: ₹${(today.yesterdaySales || 0).toLocaleString('en-IN')} (${today.yesterdayOrders || 0} orders)
• Most Recent Active Sale Date: ${today.mostRecentSaleDate || "N/A"} (Amount: ₹${(today.mostRecentSaleAmount || 0).toLocaleString('en-IN')}, Orders: ${today.mostRecentSaleOrders || 0})
• Total Cumulative Revenue: ₹${ov.totalSales.toLocaleString('en-IN')} (${ov.totalOrders} orders, Avg Order Value: ₹${ov.avgOrderValue.toLocaleString('en-IN')})
• Paid Revenue: ₹${ov.paidRevenue.toLocaleString('en-IN')} | Pending Customer Receivables: ₹${ov.pendingRevenue.toLocaleString('en-IN')}
• Cost of Goods Sold (COGS): ₹${ov.totalCogs.toLocaleString('en-IN')}
• Gross Profit: ₹${ov.grossProfit.toLocaleString('en-IN')}
• Total Operating Expenses: ₹${ov.totalExpenses.toLocaleString('en-IN')}
• Cumulative Net Profit: ₹${ov.netProfit.toLocaleString('en-IN')} (Net Profit Margin: ${ov.profitMargin}%)
• Inventory Valuation: ₹${ov.inventoryValue.toLocaleString('en-IN')} across ${inv.totalProducts} catalog products
• Inventory Status: ${inv.outOfStockCount} out of stock, ${inv.lowStockCount} low stock.
  - Out of Stock: ${inv.outOfStockItems.map((i: any) => `${i.name} (Stock: 0, Min: ${i.min_stock}, Price: ₹${i.price})`).join(', ') || 'None'}
  - Low Stock: ${inv.lowStockItems.map((i: any) => `${i.name} (Stock: ${i.stock}, Min: ${i.min_stock}, Cost: ₹${i.cost})`).join(', ') || 'None'}
  - Fast-Selling Items: ${(sls.fastSelling || []).map((f: any) => `${f.name} (${f.units} units sold)`).join(', ') || 'None'}
  - Slow-Moving Items: ${(inv.slowMovingItems || []).map((s: any) => `${s.name} (${s.stock} in stock, ${s.units_sold} sold)`).join(', ') || 'None'}
• Best Selling Products: ${sls.topProducts.map((p: any) => `${p.name} (${p.units} units, ₹${p.revenue.toLocaleString('en-IN')})`).join('; ') || 'No recorded sales'}
• Expenses by Category: ${exp.categories.map((c: any) => `${c.category}: ₹${c.amount.toLocaleString('en-IN')}`).join('; ')}
• Flagged Unusual/High Expenses: ${exp.unusualExpenses.map((u: any) => `${u.title} (₹${u.amount.toLocaleString('en-IN')} on ${u.date} - ${u.reason})`).join('; ') || 'None flagged'}
• Top Customers: ${cust.topCustomers.map((c: any) => `${c.name} (Purchases: ₹${c.total_purchases.toLocaleString('en-IN')}, Orders: ${c.total_orders}, Pending: ₹${c.pending_amount})`).join('; ') || 'None'}
• Suppliers & Procurement: ${sup.count || 0} registered vendors, ${(sup.recentPurchases || []).length} recent POs. Total spend: ₹${(sup.totalPurchases || 0).toLocaleString('en-IN')}. Top vendors: ${(sup.topSuppliers || []).map((s: any) => `${s.company_name || s.name} (₹${(s.total_purchases || 0).toLocaleString('en-IN')})`).join('; ') || 'None'}
• Most Purchased Items from Suppliers: ${(sup.topProcuredProducts || []).map((tp: any) => `${tp.product_name} (${tp.quantity} units, ₹${tp.spent.toLocaleString('en-IN')})`).join('; ') || 'None'}
• Active Smart Inventory & Sales Alerts (${(summary.alerts?.activeAlerts || []).length} active alerts in system):
${(summary.alerts?.activeAlerts || []).map((a: any) => `  - [${a.priority}] ${a.title} | Current stock: ${a.current_stock}, Min: ${a.threshold} | Action: ${a.action_recommendation}`).join('\n') || '  - No active critical or attention alerts.'}
`;

          // Format contents with conversation history
          const contents: any[] = [];
          if (Array.isArray(history) && history.length > 0) {
            history.slice(-6).forEach((h: any) => {
              if (h && h.content) {
                contents.push({
                  role: h.role === "assistant" ? "model" : "user",
                  parts: [{ text: String(h.content) }]
                });
              }
            });
          }

          contents.push({
            role: "user",
            parts: [
              {
                text: `${liveContextText}\n\nUser Question: ${message}`
              }
            ]
          });

          let replyText = "";
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3.8-flash",
              contents,
              config: {
                systemInstruction,
                temperature: 0.7,
              }
            });
            replyText = response.text || "";
          } catch (modelErr: any) {
            // Secondary attempt if primary model has temporary demand spike
            try {
              const fallbackResponse = await ai.models.generateContent({
                model: "gemini-3.7-flash",
                contents,
                config: {
                  systemInstruction,
                  temperature: 0.7,
                }
              });
              replyText = fallbackResponse.text || "";
            } catch {
              replyText = "";
            }
          }

          if (replyText) {
            return res.json({
              success: true,
              reply: replyText,
              summary,
              isLiveAi: true
            });
          }

          const fallbackReply = generateRuleBasedAnswer(message, summary);
          return res.json({
            success: true,
            reply: fallbackReply,
            summary,
            isLiveAi: false,
            note: "Response derived directly from real database metrics."
          });
        } catch (aiErr: any) {
          const fallbackReply = generateRuleBasedAnswer(message, summary);
          return res.json({
            success: true,
            reply: fallbackReply,
            summary,
            isLiveAi: false,
            note: "Response derived directly from real database metrics."
          });
        }
      }

      // If no API key configured in environment, use robust real-data analytics engine
      const reply = generateRuleBasedAnswer(message, summary);
      return res.json({
        success: true,
        reply,
        summary,
        isLiveAi: false
      });
    } catch (err: any) {
      console.error("POST /api/ai-assistant/chat error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to process chat request." });
    }
  });

  // ==========================================
  // GLOBAL SEARCH API (Fast, Multi-Entity SQLite Search)
  // ==========================================
  app.get("/api/search", async (req, res) => {
    const rawQuery = (req.query.q as string || "").trim();
    if (!rawQuery) {
      return res.json({
        success: true,
        query: "",
        results: {
          products: [],
          customers: [],
          suppliers: [],
          sales: [],
          purchases: [],
          expenses: [],
        },
        totalCount: 0
      });
    }

    const pythonScript = `
import sqlite3, json, sys, os

raw_q = sys.argv[1].strip()
pattern = f"%{raw_q}%"
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def table_exists(name):
    return cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

results = {
    'products': [],
    'customers': [],
    'suppliers': [],
    'sales': [],
    'purchases': [],
    'expenses': []
}

try:
    # 1. Search Products
    if table_exists('products'):
        p_rows = cur.execute("""
            SELECT id, name, category, sku, price, 
                   COALESCE(mrp, price) as mrp,
                   COALESCE(discount_percent, 0.0) as discount_percent,
                   COALESCE(discount_amount, 0.0) as discount_amount,
                   stock_quantity, min_stock_level,
                   COALESCE(max_stock_level, 50) as max_stock_level,
                   COALESCE(supplier, '') as supplier,
                   COALESCE(brand, '') as brand,
                   CASE 
                       WHEN stock_quantity <= 0 THEN 'Out of Stock'
                       WHEN stock_quantity <= min_stock_level THEN 'Low Stock'
                       WHEN max_stock_level IS NOT NULL AND max_stock_level > 0 AND stock_quantity > max_stock_level THEN 'Overstock'
                       ELSE 'In Stock'
                   END as status
            FROM products 
            WHERE name LIKE ? OR sku LIKE ? OR category LIKE ? OR brand LIKE ? OR supplier LIKE ?
            ORDER BY name ASC LIMIT 15
        """, (pattern, pattern, pattern, pattern, pattern)).fetchall()
        results['products'] = [dict(r) for r in p_rows]

    # 2. Search Customers
    if table_exists('customers'):
        c_rows = cur.execute("""
            SELECT id, name, phone, COALESCE(email, '') as email, COALESCE(address, '') as address,
                   COALESCE(total_purchases, 0) as total_purchases,
                   COALESCE(pending_amount, 0) as pending_amount,
                   COALESCE(last_purchase_date, '') as last_purchase_date
            FROM customers
            WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?
            ORDER BY name ASC LIMIT 15
        """, (pattern, pattern, pattern, pattern)).fetchall()
        results['customers'] = [dict(r) for r in c_rows]

    # 3. Search Suppliers (Requirement 1 & 8)
    if table_exists('suppliers'):
        sup_rows = cur.execute("""
            SELECT id, name, company_name, mobile, COALESCE(email, '') as email,
                   COALESCE(address, '') as address, COALESCE(notes, '') as notes,
                   COALESCE(total_purchases, 0.0) as total_purchases,
                   COALESCE(last_purchase_date, '') as last_purchase_date
            FROM suppliers
            WHERE name LIKE ? OR company_name LIKE ? OR mobile LIKE ? OR email LIKE ? OR address LIKE ? OR notes LIKE ?
            ORDER BY company_name ASC LIMIT 15
        """, (pattern, pattern, pattern, pattern, pattern, pattern)).fetchall()
        results['suppliers'] = [dict(r) for r in sup_rows]

    # 4. Search Sales & Invoices
    if table_exists('sales'):
        s_rows = cur.execute("""
            SELECT id, COALESCE(invoice_no, 'INV-' || id) as invoice_no, customer_name,
                   COALESCE(customer_phone, '') as customer_phone,
                   COALESCE(product_name, '') as product_name,
                   total_amount, COALESCE(payment_status, 'Paid') as payment_status,
                   COALESCE(payment_method, 'Cash') as payment_method,
                   sale_date
            FROM sales
            WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR product_name LIKE ? OR sale_date LIKE ?
            ORDER BY sale_date DESC, id DESC LIMIT 15
        """, (pattern, pattern, pattern, pattern, pattern)).fetchall()
        results['sales'] = [dict(r) for r in s_rows]

    # 5. Search Purchases (Handles supplier_purchases and purchases)
    p_table = 'supplier_purchases' if table_exists('supplier_purchases') else ('purchases' if table_exists('purchases') else None)
    if p_table:
        pr_rows = cur.execute(f"""
            SELECT p.id,
                   COALESCE(NULLIF(p.invoice_no, ''), NULLIF(p.purchase_order_no, ''), 'PUR-' || p.id) as invoice_no,
                   COALESCE(s.company_name, s.name, 'Supplier') as supplier_name,
                   p.product_name,
                   p.total_amount as total_cost,
                   p.purchase_date,
                   COALESCE(p.payment_status, 'Paid') as payment_status
            FROM {p_table} p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.invoice_no LIKE ? OR p.purchase_order_no LIKE ? OR p.product_name LIKE ? OR p.purchase_date LIKE ? OR s.company_name LIKE ? OR s.name LIKE ?
            ORDER BY p.purchase_date DESC, p.id DESC LIMIT 15
        """, (pattern, pattern, pattern, pattern, pattern, pattern)).fetchall()
        results['purchases'] = [dict(r) for r in pr_rows]

    # 6. Search Expenses
    if table_exists('expenses'):
        e_rows = cur.execute("""
            SELECT id, title, category, amount, expense_date,
                   COALESCE(payment_method, 'Cash') as payment_method,
                   COALESCE(notes, '') as notes
            FROM expenses
            WHERE title LIKE ? OR category LIKE ? OR notes LIKE ? OR expense_date LIKE ?
            ORDER BY expense_date DESC, id DESC LIMIT 15
        """, (pattern, pattern, pattern, pattern)).fetchall()
        results['expenses'] = [dict(r) for r in e_rows]

    total_count = sum(len(v) for v in results.values())
    print(json.dumps({'success': True, 'query': raw_q, 'results': results, 'totalCount': total_count}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e), 'results': results, 'totalCount': 0}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [rawQuery]);
      res.json(data);
    } catch (err: any) {
      console.error("GET /api/search error:", err);
      res.status(500).json({ success: false, error: err.message, results: {}, totalCount: 0 });
    }
  });

  // ==========================================
  // BUSINESS SETTINGS API (Requirement 16)
  // ==========================================
  app.get("/api/settings", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    row = cur.execute("SELECT * FROM business_settings WHERE id = 1").fetchone()
    if row:
        d = dict(row)
        d['notify_low_stock'] = bool(d.get('notify_low_stock', 1))
        d['notify_out_of_stock'] = bool(d.get('notify_out_of_stock', 1))
        d['notify_suspicious_discount'] = bool(d.get('notify_suspicious_discount', 1))
        d['notify_customer_dues'] = bool(d.get('notify_customer_dues', 1))
        d['notify_overdue'] = bool(d.get('notify_overdue', 1))
        print(json.dumps({'success': True, 'settings': d}))
    else:
        print(json.dumps({'success': False, 'error': 'Settings not initialized'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    const {
      business_name,
      business_logo,
      currency,
      currency_symbol,
      tax_rate,
      low_stock_threshold,
      discount_low_max,
      discount_med_max,
      discount_high_max,
      invoice_prefix,
      invoice_notes,
      notify_low_stock,
      notify_out_of_stock,
      notify_suspicious_discount,
      notify_customer_dues,
      notify_overdue
    } = req.body || {};

    const payload = {
      business_name: business_name ? String(business_name).trim() : "Smart Commerce Enterprises",
      business_logo: business_logo ? String(business_logo).trim() : "",
      currency: currency || "INR (₹)",
      currency_symbol: currency_symbol || "₹",
      tax_rate: parseFloat(tax_rate) || 18.0,
      low_stock_threshold: parseInt(low_stock_threshold, 10) || 5,
      discount_low_max: parseFloat(discount_low_max) || 5.0,
      discount_med_max: parseFloat(discount_med_max) || 20.0,
      discount_high_max: parseFloat(discount_high_max) || 40.0,
      invoice_prefix: invoice_prefix ? String(invoice_prefix).trim() : "INV-",
      invoice_notes: invoice_notes ? String(invoice_notes).trim() : "Thank you for your business!",
      notify_low_stock: notify_low_stock !== false ? 1 : 0,
      notify_out_of_stock: notify_out_of_stock !== false ? 1 : 0,
      notify_suspicious_discount: notify_suspicious_discount !== false ? 1 : 0,
      notify_customer_dues: notify_customer_dues !== false ? 1 : 0,
      notify_overdue: notify_overdue !== false ? 1 : 0
    };

    const pythonScript = `
import sqlite3, json, sys, os

args = json.loads(sys.argv[1])
db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

try:
    cur.execute("""
        UPDATE business_settings
        SET business_name = ?,
            currency = ?,
            currency_symbol = ?,
            tax_rate = ?,
            low_stock_threshold = ?,
            discount_low_max = ?,
            discount_med_max = ?,
            discount_high_max = ?,
            invoice_prefix = ?,
            invoice_notes = ?,
            notify_low_stock = ?,
            notify_out_of_stock = ?,
            notify_suspicious_discount = ?,
            notify_customer_dues = ?,
            notify_overdue = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (
        args['business_name'],
        args['currency'],
        args['currency_symbol'],
        args['tax_rate'],
        args['low_stock_threshold'],
        args['discount_low_max'],
        args['discount_med_max'],
        args['discount_high_max'],
        args['invoice_prefix'],
        args['invoice_notes'],
        args['notify_low_stock'],
        args['notify_out_of_stock'],
        args['notify_suspicious_discount'],
        args['notify_customer_dues'],
        args['notify_overdue']
    ))
    conn.commit()
    row = cur.execute("SELECT * FROM business_settings WHERE id = 1").fetchone()
    d = dict(row)
    d['notify_low_stock'] = bool(d.get('notify_low_stock', 1))
    d['notify_out_of_stock'] = bool(d.get('notify_out_of_stock', 1))
    d['notify_suspicious_discount'] = bool(d.get('notify_suspicious_discount', 1))
    d['notify_customer_dues'] = bool(d.get('notify_customer_dues', 1))
    d['notify_overdue'] = bool(d.get('notify_overdue', 1))
    print(json.dumps({'success': True, 'settings': d, 'message': 'Business settings updated successfully.'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
finally:
    conn.close()
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify(payload)]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // VOICE COMMAND ASSISTANT & PROCESSING API (Phase 5)
  // ==========================================
  app.post("/api/voice/process-command", async (req, res) => {
    const rawText = (req.body?.text || "").trim();
    if (!rawText) {
      return res.status(400).json({ success: false, error: "Command text is required." });
    }

    try {
      const summary = await getBusinessDataSummary();
      const lower = rawText.toLowerCase();

      // Check intent: Sales Check
      if (lower.includes("sale") || lower.includes("revenue") || lower.includes("kamai") || lower.includes("bikri") || lower.includes("turnover")) {
        const todaySales = summary.overview?.todaySales || 0;
        const totalSales = summary.overview?.totalSales || 0;
        const ordersCount = summary.salesSummary?.count || 0;
        const spoken = `Today's sales total ₹${todaySales.toLocaleString('en-IN')}. Overall, you have recorded ${ordersCount} sales totaling ₹${totalSales.toLocaleString('en-IN')}.`;
        return res.json({
          success: true,
          intent: "sales_query",
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "navigate", tab: "sales" }
        });
      }

      // Check intent: Profit & Loss Check
      if (lower.includes("profit") || lower.includes("margin") || lower.includes("munafa") || lower.includes("p&l") || lower.includes("loss")) {
        const gross = summary.overview?.grossProfit || 0;
        const net = summary.overview?.netProfit || 0;
        const margin = summary.overview?.netProfitMargin || 0;
        const spoken = `Your current Net Profit is ₹${net.toLocaleString('en-IN')} with a profit margin of ${margin.toFixed(1)}%. Gross profit stands at ₹${gross.toLocaleString('en-IN')}.`;
        return res.json({
          success: true,
          intent: "profit_query",
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "navigate", tab: "analytics" }
        });
      }

      // Check intent: Expenses Check
      if (lower.includes("expense") || lower.includes("kharch") || lower.includes("cost") || lower.includes("bill")) {
        const todayExp = summary.overview?.todayExpenses || 0;
        const totalExp = summary.overview?.totalExpenses || 0;
        const spoken = `Today's operating expenses are ₹${todayExp.toLocaleString('en-IN')}, and total business expenses stand at ₹${totalExp.toLocaleString('en-IN')}.`;
        return res.json({
          success: true,
          intent: "expense_query",
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "navigate", tab: "expenses" }
        });
      }

      // Check intent: Stock or Inventory Check
      if (lower.includes("stock") || lower.includes("inventory") || lower.includes("saman") || lower.includes("maal")) {
        // Specific product stock lookup
        const prods = summary.products || [];
        let matchedProd = null;
        for (const p of prods) {
          if (p.name && lower.includes(p.name.toLowerCase())) {
            matchedProd = p;
            break;
          }
        }
        if (matchedProd) {
          const spoken = `${matchedProd.name} currently has ${matchedProd.stock_quantity} units available in stock. The minimum reorder threshold is ${matchedProd.min_stock_level} units.`;
          return res.json({
            success: true,
            intent: "product_stock_query",
            spokenResponse: spoken,
            textResponse: spoken,
            product: matchedProd,
            action: { type: "navigate", tab: "inventory" }
          });
        }

        const outOfStock = (summary.inventory?.outOfStockItems || []).length;
        const lowStock = (summary.inventory?.lowStockItems || []).length;
        const spoken = `You currently have ${outOfStock} out of stock products and ${lowStock} products running below their minimum reorder level.`;
        return res.json({
          success: true,
          intent: "inventory_summary",
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "navigate", tab: "inventory" }
        });
      }

      // Check intent: Smart Alerts Check
      if (lower.includes("alert") || lower.includes("warning") || lower.includes("notification") || lower.includes("dhyaan")) {
        const count = summary.alerts?.totalCount || 0;
        const critical = summary.alerts?.criticalCount || 0;
        const spoken = `You have ${count} active smart inventory alerts, including ${critical} critical alerts requiring urgent attention.`;
        return res.json({
          success: true,
          intent: "alert_query",
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "open_alerts" }
        });
      }

      // Check intent: Record Sale Intent (Safe Confirmation Required)
      if (lower.startsWith("record sale") || lower.startsWith("add sale") || lower.startsWith("new sale") || lower.includes("sale banao") || lower.includes("bikri jodo")) {
        // Parse possible quantity and product
        const prods = summary.products || [];
        let detectedProduct = prods[0] || null;
        for (const p of prods) {
          if (p.name && lower.includes(p.name.toLowerCase())) {
            detectedProduct = p;
            break;
          }
        }
        const qtyMatch = lower.match(/\b(\d+)\s*(unit|piece|item|box|kg|pc)?\b/);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

        const draftData = {
          product_id: detectedProduct ? detectedProduct.id : null,
          product_name: detectedProduct ? detectedProduct.name : "Custom Item",
          quantity: qty,
          unit_price: detectedProduct ? detectedProduct.price : 100,
          customer_name: "Walk-in Customer",
          payment_method: "Cash"
        };

        const spoken = `I prepared a draft sale of ${qty} ${draftData.product_name}. Please confirm the details in the dialog to save this transaction.`;
        return res.json({
          success: true,
          intent: "record_sale_intent",
          requiresConfirmation: true,
          draftType: "sale",
          draftData,
          prompt: `Confirm recording sale: ${qty}x ${draftData.product_name} @ ₹${draftData.unit_price} each?`,
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "open_confirm_sale", draftData }
        });
      }

      // Check intent: Log Expense Intent (Safe Confirmation Required)
      if (lower.startsWith("log expense") || lower.startsWith("add expense") || lower.includes("kharcha jodo") || lower.includes("record expense")) {
        const amtMatch = lower.match(/(?:rs\.?|inr|₹|\b)?\s*(\d+(?:\.\d{1,2})?)/);
        const amt = amtMatch ? parseFloat(amtMatch[1]) : 500;
        
        let category = "Other";
        if (lower.includes("rent")) category = "Rent";
        else if (lower.includes("salary") || lower.includes("vetan")) category = "Salary";
        else if (lower.includes("electricity") || lower.includes("bijli")) category = "Electricity";
        else if (lower.includes("tea") || lower.includes("food") || lower.includes("chai") || lower.includes("snack")) category = "Other";
        else if (lower.includes("transport") || lower.includes("petrol") || lower.includes("diesel")) category = "Transport";
        else if (lower.includes("marketing") || lower.includes("ad")) category = "Marketing";

        const draftData = {
          category,
          title: `Voice Logged: ${category} Expense`,
          amount: amt,
          payment_method: "Cash",
          expense_date: new Date().toISOString().split("T")[0]
        };

        const spoken = `I prepared a draft expense of ₹${amt} for ${category}. Please review and confirm to log this expense safely.`;
        return res.json({
          success: true,
          intent: "log_expense_intent",
          requiresConfirmation: true,
          draftType: "expense",
          draftData,
          prompt: `Confirm logging expense: ₹${amt} under ${category}?`,
          spokenResponse: spoken,
          textResponse: spoken,
          action: { type: "open_confirm_expense", draftData }
        });
      }

      // Fallback: Use rule-based assistant answer for general questions
      const answer = generateRuleBasedAnswer(rawText, summary);
      const cleanSpoken = answer.replace(/[•*#_\[\]]/g, " ").replace(/\s+/g, " ").slice(0, 300);
      return res.json({
        success: true,
        intent: "general_ai_query",
        spokenResponse: cleanSpoken,
        textResponse: answer
      });
    } catch (err: any) {
      console.error("POST /api/voice/process-command error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to process voice command." });
    }
  });

  // Verify SQLite database tables, row counts, and schema status
  app.get("/api/verify-sqlite", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
exists = os.path.exists(db_path)
size = os.path.getsize(db_path) if exists else 0

result = {
    'database_exists': exists,
    'file_size_bytes': size,
    'tables': {}
}

if exists:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    table_names = [t[0] for t in tables if not t[0].startswith('sqlite_')]
    for tbl in table_names:
        count = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        cols = [c[1] for c in cur.execute(f"PRAGMA table_info({tbl})").fetchall()]
        result['tables'][tbl] = {'count': count, 'columns': cols}
    conn.close()

print(json.dumps(result))
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Verification tool: insert a real test record into SQLite so user can test live data flow
  app.post("/api/test-record", async (req, res) => {
    const { type, payload } = req.body;
    const pythonScript = `
import sqlite3, json, sys, datetime, os

args = json.loads(sys.argv[1])
record_type = args.get('type')
p = args.get('payload', {})

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

today = datetime.date.today().isoformat()

if record_type == 'sale':
    cur.execute(
        "INSERT INTO sales (customer_name, product_name, quantity, total_amount, sale_date) VALUES (?, ?, ?, ?, ?)",
        (p.get('customer', 'Acme Corp'), p.get('product', 'Office Chair Pro'), int(p.get('qty', 2)), float(p.get('total', 250.0)), today)
    )
elif record_type == 'expense':
    cur.execute(
        "INSERT INTO expenses (category, amount, expense_date, description) VALUES (?, ?, ?, ?)",
        (p.get('category', 'Utilities'), float(p.get('amount', 75.0)), today, p.get('desc', 'High-speed Internet'))
    )
elif record_type == 'product_low':
    cur.execute(
        "INSERT INTO products (name, category, price, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?)",
        (p.get('name', 'Printer Toner Black'), 'Supplies', 49.99, int(p.get('stock', 2)), int(p.get('min', 5)))
    )
elif record_type == 'product_normal':
    cur.execute(
        "INSERT INTO products (name, category, price, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?)",
        (p.get('name', 'Wireless Mouse Pro'), 'Hardware', 29.99, 45, 10)
    )
elif record_type == 'employee':
    cur.execute(
        "INSERT INTO employees (name, phone, email, role, department, salary, joining_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            p.get('name', 'Sarah Jenkins'),
            p.get('phone', '(555) 234-5678'),
            p.get('email', 'sarah.j@smartbiz.local'),
            p.get('role', 'Operations Manager'),
            p.get('dept', 'Logistics'),
            float(p.get('salary', 65000.0)),
            p.get('joining_date', today),
            p.get('status', 'Active')
        )
    )

conn.commit()
conn.close()
print(json.dumps({'success': True, 'type': record_type}))
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript, [JSON.stringify({ type, payload })]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear test data from business tables (preserves users table)
  app.post("/api/clear-test-data", async (_req, res) => {
    const pythonScript = `
import sqlite3, json, os

db_path = os.path.join('smart_business_manager', 'business.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

for tbl in ['sales', 'expenses', 'products', 'employees']:
    try:
        cur.execute(f"DELETE FROM {tbl}")
    except:
        pass

conn.commit()
conn.close()
print(json.dumps({'success': True, 'message': 'Business data cleared. Users preserved.'}))
`;
    try {
      const data = await runPythonSqliteQuery(pythonScript);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
