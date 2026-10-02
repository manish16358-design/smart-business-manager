import { ProjectFile } from "../types";

export const PROJECT_FILES: ProjectFile[] = [
  {
    name: "app.py",
    path: "smart_business_manager/app.py",
    language: "python",
    description: "Flask backend handling authentication, SQLite database operations, session tracking, and dashboard metric calculations.",
    content: `"""
Smart Business Manager - Step 2: Dashboard
A clean, secure Python Flask web application with SQLite database authentication
and real-time business management metrics.
"""

import os
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize Flask application
app = Flask(__name__)
# Secret key for session signing
app.secret_key = os.environ.get('SECRET_KEY', 'smart-business-manager-secure-secret-2026')

# Path to the SQLite database
DATABASE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'business.db')


def get_db_connection():
    """Establish a connection to the SQLite database with dict-like row access."""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn, table_name):
    """Check if a table exists in SQLite database safely."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", 
        (table_name,)
    )
    return cursor.fetchone() is not None


def init_db():
    """
    Safely initialize SQLite database without deleting or recreating existing data.
    1. Preserves existing 'users' table and default admin credentials.
    2. Ensures schema readiness for products, sales, expenses, and employees.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Step 1: Users table for authentication
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)

    # Check if default admin user already exists
    cursor.execute("SELECT id FROM users WHERE username = ?", ('admin',))
    existing_user = cursor.fetchone()

    if not existing_user:
        hashed_password = generate_password_hash('admin123')
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            ('admin', hashed_password)
        )
        print("Default admin user created successfully (Username: admin, Password: admin123).")

    # Step 2: Tables for business operations (created safely IF NOT EXISTS, no fake data)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            price REAL DEFAULT 0.0,
            stock_quantity INTEGER DEFAULT 0,
            min_stock_level INTEGER DEFAULT 5
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            total_amount REAL NOT NULL,
            sale_date TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date TEXT NOT NULL,
            description TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT,
            department TEXT,
            salary REAL
        )
    """)

    conn.commit()
    conn.close()


def get_dashboard_metrics():
    """
    Query real SQLite database metrics safely.
    If a table does not exist yet or has no records, safely returns 0 or empty lists.
    No fake data is injected.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')

    # 1. Today's Sales
    today_sales = 0.0
    if table_exists(conn, 'sales'):
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(total_amount), 0.0) as total
                FROM sales 
                WHERE date(sale_date) = date(?)
            """, (today_str,))
            row = cursor.fetchone()
            today_sales = float(row['total']) if row and row['total'] is not None else 0.0
        except sqlite3.OperationalError:
            today_sales = 0.0

    # 2. Today's Expenses
    today_expenses = 0.0
    if table_exists(conn, 'expenses'):
        try:
            cursor.execute("""
                SELECT COALESCE(SUM(amount), 0.0) as total
                FROM expenses 
                WHERE date(expense_date) = date(?)
            """, (today_str,))
            row = cursor.fetchone()
            today_expenses = float(row['total']) if row and row['total'] is not None else 0.0
        except sqlite3.OperationalError:
            today_expenses = 0.0

    # 3. Today's Profit = Today's Sales - Today's Expenses
    today_profit = round(today_sales - today_expenses, 2)

    # 4. Total Products & Low Stock Alert
    total_products = 0
    low_stock_count = 0
    low_stock_products = []
    if table_exists(conn, 'products'):
        try:
            cursor.execute("SELECT COUNT(*) as cnt FROM products")
            row = cursor.fetchone()
            total_products = int(row['cnt']) if row else 0

            cursor.execute("""
                SELECT id, name, stock_quantity, min_stock_level
                FROM products
                WHERE stock_quantity <= min_stock_level
                ORDER BY stock_quantity ASC
            """)
            low_stock_products = [dict(r) for r in cursor.fetchall()]
            low_stock_count = len(low_stock_products)
        except sqlite3.OperationalError:
            total_products = 0
            low_stock_count = 0
            low_stock_products = []

    # 5. Total Employees
    total_employees = 0
    if table_exists(conn, 'employees'):
        try:
            cursor.execute("SELECT COUNT(*) as cnt FROM employees")
            row = cursor.fetchone()
            total_employees = int(row['cnt']) if row else 0
        except sqlite3.OperationalError:
            total_employees = 0

    # 6. Recent Sales (up to 10 latest)
    recent_sales = []
    if table_exists(conn, 'sales'):
        try:
            cursor.execute("""
                SELECT id, customer_name, product_name, quantity, total_amount, sale_date
                FROM sales
                ORDER BY id DESC
                LIMIT 10
            """)
            recent_sales = [dict(r) for r in cursor.fetchall()]
        except sqlite3.OperationalError:
            recent_sales = []

    # 7. Sales for the Last 7 Days (using actual database sales data, 0 if no sales)
    chart_data = []
    for i in range(6, -1, -1):
        day = datetime.now() - timedelta(days=i)
        day_str = day.strftime('%Y-%m-%d')
        label = day.strftime('%b %d')
        day_total = 0.0

        if table_exists(conn, 'sales'):
            try:
                cursor.execute("""
                    SELECT COALESCE(SUM(total_amount), 0.0) as total
                    FROM sales
                    WHERE date(sale_date) = date(?)
                """, (day_str,))
                row = cursor.fetchone()
                day_total = float(row['total']) if row and row['total'] is not None else 0.0
            except sqlite3.OperationalError:
                day_total = 0.0

        chart_data.append({
            'date': day_str,
            'label': label,
            'total': round(day_total, 2)
        })

    conn.close()

    return {
        'today_sales': round(today_sales, 2),
        'today_expenses': round(today_expenses, 2),
        'today_profit': today_profit,
        'total_products': total_products,
        'low_stock_count': low_stock_count,
        'low_stock_products': low_stock_products,
        'total_employees': total_employees,
        'recent_sales': recent_sales,
        'chart_data': chart_data
    }


def login_required(f):
    """Decorator to protect routes requiring authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


@app.route('/')
def index():
    """Root route: redirect to dashboard if logged in, otherwise to login."""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login and authentication verification."""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))

    error = None

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            error = "Please enter both username and password."
        else:
            conn = get_db_connection()
            user = conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()
            conn.close()

            if user and check_password_hash(user['password_hash'], password):
                session.clear()
                session['user_id'] = user['id']
                session['username'] = user['username']
                return redirect(url_for('dashboard'))
            else:
                error = "Invalid username or password. Please try again."

    return render_template('login.html', error=error)


@app.route('/dashboard')
@login_required
def dashboard():
    """Protected dashboard route loading real SQLite metrics."""
    username = session.get('username', 'User')
    metrics = get_dashboard_metrics()
    return render_template('dashboard.html', username=username, metrics=metrics)


@app.route('/api/metrics')
@login_required
def api_metrics():
    """JSON API endpoint returning real-time SQLite metrics."""
    return jsonify(get_dashboard_metrics())


@app.route('/logout', methods=['GET', 'POST'])
def logout():
    """Log the user out and clear the session."""
    session.clear()
    return redirect(url_for('login'))


if __name__ == '__main__':
    init_db()
    print("Starting Smart Business Manager on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
`,
  },
  {
    name: "dashboard.html",
    path: "smart_business_manager/templates/dashboard.html",
    language: "html",
    description: "Jinja2 dashboard template with header, sidebar, 6 summary cards, 7-day sales chart, recent sales, and low-stock alerts.",
    content: `<!-- Jinja2 Dashboard Template with real SQLite Data -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Smart Business Manager</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body class="dashboard-body">

    <!-- Top Header -->
    <header class="top-header" id="mainHeader">
        <div class="header-left">
            <button type="button" class="mobile-menu-toggle" id="mobileMenuBtn">
                <!-- Hamburger Icon -->
            </button>
            <div class="header-brand">
                <span class="brand-text">Smart Business Manager</span>
            </div>
        </div>
        <div class="header-right">
            <span class="user-name-display">{{ username }}</span>
            <a href="{{ url_for('logout') }}" class="btn-logout">Logout</a>
        </div>
    </header>

    <div class="app-layout">
        <!-- Sidebar Navigation -->
        <aside class="app-sidebar" id="appSidebar">
            <nav class="sidebar-nav">
                <a href="{{ url_for('dashboard') }}" class="nav-item active">Dashboard</a>
                <button class="nav-item nav-coming-soon">Sales &amp; Billing</button>
                <button class="nav-item nav-coming-soon">Inventory</button>
                <button class="nav-item nav-coming-soon">Employees</button>
                <button class="nav-item nav-coming-soon">Customers</button>
                <button class="nav-item nav-coming-soon">Expenses</button>
                <button class="nav-item nav-coming-soon">Reports</button>
                <button class="nav-item nav-coming-soon">AI Assistant</button>
                <button class="nav-item nav-coming-soon">Settings</button>
                <a href="{{ url_for('logout') }}" class="nav-item nav-logout">Logout</a>
            </nav>
        </aside>

        <!-- Main Content -->
        <main class="dashboard-content">
            <!-- 6 Summary Cards -->
            <div class="summary-cards-grid">
                <div class="summary-card">Today's Sales: $\{{ "%.2f"|format(metrics.today_sales) }}</div>
                <div class="summary-card">Today's Expenses: $\{{ "%.2f"|format(metrics.today_expenses) }}</div>
                <div class="summary-card">Today's Profit: $\{{ "%.2f"|format(metrics.today_profit) }}</div>
                <div class="summary-card">Total Products: \{{ metrics.total_products }}</div>
                <div class="summary-card">Low Stock Products: \{{ metrics.low_stock_count }}</div>
                <div class="summary-card">Total Employees: \{{ metrics.total_employees }}</div>
            </div>

            <!-- 7-Day Sales Chart -->
            <div class="chart-section-card">...</div>

            <!-- Recent Sales & Low Stock Alert -->
            <div class="dashboard-grid-split">...</div>
        </main>
    </div>
</body>
</html>`,
  },
  {
    name: "login.html",
    path: "smart_business_manager/templates/login.html",
    language: "html",
    description: "Jinja2 template for user login with session auth and error message display.",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Smart Business Manager</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body class="auth-body">
    <div class="auth-wrapper">
        <div class="auth-card" id="loginCard">
            <div class="brand-header">
                <h1 class="brand-title">Smart Business Manager</h1>
                <p class="brand-subtitle">Sign in to your management dashboard</p>
            </div>
            {% if error %}
            <div class="alert alert-danger">{{ error }}</div>
            {% endif %}
            <form action="{{ url_for('login') }}" method="POST" class="auth-form">
                <input type="text" name="username" placeholder="Username" required>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit" class="btn btn-primary">Sign In</button>
            </form>
        </div>
    </div>
</body>
</html>`,
  },
  {
    name: "style.css",
    path: "smart_business_manager/static/css/style.css",
    language: "css",
    description: "Responsive CSS stylesheet for login, navigation sidebar, summary cards, chart, and tables.",
    content: `/* Mobile-friendly, high-contrast, modern business management design */
:root {
    --bg-app: #f8fafc;
    --surface-card: #ffffff;
    --border-color: #e2e8f0;
    --brand-accent: #2563eb;
    --text-primary: #0f172a;
}
/* Responsive grid & sidebar navigation styling */
`,
  },
  {
    name: "requirements.txt",
    path: "smart_business_manager/requirements.txt",
    language: "text",
    description: "Python dependencies for the Flask and Werkzeug runtime.",
    content: `Flask>=3.0.0
Werkzeug>=3.0.0
`,
  }
];
