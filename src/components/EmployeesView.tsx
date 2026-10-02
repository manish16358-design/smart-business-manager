import React, { useState } from "react";
import { EmployeeItem } from "../types";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  X,
  LayoutGrid,
  Table as TableIcon,
  Database,
  Filter,
  AlertTriangle,
  RefreshCw,
  Download,
  ArrowUpDown,
  BadgeDollarSign,
} from "lucide-react";

interface EmployeesViewProps {
  employees: EmployeeItem[];
  onAddEmployee: (employee: Omit<EmployeeItem, "id">) => Promise<boolean | void> | void;
  onUpdateEmployee: (employee: EmployeeItem) => Promise<boolean | void> | void;
  onDeleteEmployee: (id: number) => Promise<boolean | void> | void;
  onRefresh?: () => void;
  sqliteConnected?: boolean;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onRefresh,
  sqliteConnected = true,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortBy, setSortBy] = useState<"name" | "salary" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In-page feedback banner
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 4500);
  };

  // Form states for Add / Edit
  const todayDateStr = "2026-09-22";
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formDepartment, setFormDepartment] = useState("Sales & Billing");
  const [formSalary, setFormSalary] = useState("45000");
  const [formJoiningDate, setFormJoiningDate] = useState(todayDateStr);
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  // Helper to open Add Modal
  const openAddModal = () => {
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormRole("");
    setFormDepartment("Sales & Billing");
    setFormSalary("45000");
    setFormJoiningDate(todayDateStr);
    setFormStatus("Active");
    setIsAddModalOpen(true);
  };

  // Helper to open Edit Modal
  const openEditModal = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormPhone(emp.phone || "");
    setFormEmail(emp.email || "");
    setFormRole(emp.role);
    setFormDepartment(emp.department || "General");
    setFormSalary(emp.salary ? emp.salary.toString() : "0");
    setFormJoiningDate(emp.joining_date || todayDateStr);
    setFormStatus(
      emp.status === "Inactive" || (emp.status as string).toLowerCase() === "inactive"
        ? "Inactive"
        : "Active"
    );
  };

  // Submission handler for Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRole.trim()) {
      showFeedback("error", "Please provide both Employee Full Name and Job Role.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddEmployee({
        name: formName.trim(),
        phone: formPhone.trim() || "(555) 000-0000",
        email:
          formEmail.trim() ||
          `${formName.toLowerCase().replace(/\s+/g, ".")}@smartbiz.local`,
        role: formRole.trim(),
        department: formDepartment,
        salary: parseFloat(formSalary) || 0,
        joining_date: formJoiningDate || todayDateStr,
        status: formStatus,
      });
      setIsAddModalOpen(false);
      showFeedback("success", `Employee "${formName.trim()}" permanently saved to SQLite database!`);
    } catch (err: any) {
      showFeedback("error", err?.message || "Failed to add employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submission handler for Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!formName.trim() || !formRole.trim()) {
      showFeedback("error", "Please provide both Employee Full Name and Job Role.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateEmployee({
        id: editingEmployee.id,
        name: formName.trim(),
        phone: formPhone.trim() || "(555) 000-0000",
        email:
          formEmail.trim() ||
          `${formName.toLowerCase().replace(/\s+/g, ".")}@smartbiz.local`,
        role: formRole.trim(),
        department: formDepartment,
        salary: parseFloat(formSalary) || 0,
        joining_date: formJoiningDate || todayDateStr,
        status: formStatus,
      });
      setEditingEmployee(null);
      showFeedback(
        "success",
        `Employee "${formName.trim()}" updated successfully in SQLite database.`
      );
    } catch (err: any) {
      showFeedback("error", err?.message || "Failed to update employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Confirming Delete
  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;
    setIsSubmitting(true);
    try {
      await onDeleteEmployee(deletingEmployee.id);
      showFeedback(
        "success",
        `Employee "${deletingEmployee.name}" deleted permanently from SQLite.`
      );
      setDeletingEmployee(null);
    } catch (err: any) {
      showFeedback("error", err?.message || "Failed to delete employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Requirement 8: Automatic KPI updates
  // Total Staff, Active Staff, Inactive Staff and Monthly Payroll
  const totalEmployeesCount = employees.length;
  const activeCount = employees.filter(
    (e) => (e.status || "").toLowerCase() === "active"
  ).length;
  const inactiveCount = totalEmployeesCount - activeCount;

  // Active payroll (annual & monthly)
  const activePayroll = employees
    .filter((e) => (e.status || "").toLowerCase() === "active")
    .reduce((sum, e) => sum + (Number(e.salary) || 0), 0);
  const monthlyPayroll = Math.round(activePayroll / 12);
  const averageSalary =
    activeCount > 0 ? Math.round(activePayroll / activeCount) : 0;

  // Filter departments for dropdown
  const departmentsList = [
    "all",
    ...Array.from(new Set(employees.map((e) => e.department).filter(Boolean))),
  ];

  // Filtered & Sorted employees list
  const filteredEmployees = employees
    .filter((emp) => {
      const isEmpActive = (emp.status || "").toLowerCase() === "active";
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "Active"
          ? isEmpActive
          : !isEmpActive;

      const matchesDept = departmentFilter === "all" || emp.department === departmentFilter;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        emp.name.toLowerCase().includes(searchLower) ||
        emp.role.toLowerCase().includes(searchLower) ||
        (emp.email && emp.email.toLowerCase().includes(searchLower)) ||
        (emp.phone && emp.phone.includes(searchTerm)) ||
        (emp.department && emp.department.toLowerCase().includes(searchLower));

      return matchesStatus && matchesDept && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortBy === "salary") {
        return sortOrder === "asc"
          ? (a.salary || 0) - (b.salary || 0)
          : (b.salary || 0) - (a.salary || 0);
      }
      if (sortBy === "date") {
        return sortOrder === "asc"
          ? (a.joining_date || "").localeCompare(b.joining_date || "")
          : (b.joining_date || "").localeCompare(a.joining_date || "");
      }
      return 0;
    });

  // CSV Export for Employee Roster
  const handleExportCSV = () => {
    const csvRows = [
      ["Employee ID", "Full Name", "Job Role", "Department", "Phone", "Email", "Salary", "Joining Date", "Status"],
      ...filteredEmployees.map((e) => [
        `EMP-${e.id.toString().padStart(3, "0")}`,
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.role.replace(/"/g, '""')}"`,
        `"${(e.department || "General").replace(/"/g, '""')}"`,
        `"${(e.phone || "").replace(/"/g, '""')}"`,
        `"${(e.email || "").replace(/"/g, '""')}"`,
        e.salary || 0,
        e.joining_date || "",
        (e.status || "").toLowerCase() === "active" ? "Active" : "Inactive",
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `employees_directory_${todayDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedbackBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="p-1 hover:bg-black/5 rounded-md cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Requirement 8: Top 4 KPI Summary Badges (Auto-updating) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Staff */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
            {totalEmployeesCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">All registered employees</div>
        </div>

        {/* 2. Active Staff */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Active Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-600">
            {activeCount}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700/80 font-medium">
            Currently working &amp; on-duty
          </div>
        </div>

        {/* 3. Inactive Staff */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inactive Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-600">
            {inactiveCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">On leave or offboarded</div>
        </div>

        {/* 4. Monthly Payroll */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
              Monthly Payroll
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-indigo-950">
            ${monthlyPayroll.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-indigo-600/80 font-medium">
            ${activePayroll.toLocaleString()}/yr active total
          </div>
        </div>
      </div>

      {/* Main Header & Controls Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Employees Directory
              </h2>
              {sqliteConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Database className="w-3 h-3 text-emerald-600" />
                  SQLite Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage company team members, compensation, roles, and contacts with automatic payroll updates.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh from SQLite Database"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleExportCSV}
              title="Download CSV"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* View Mode Toggle: Table vs Cards */}
            <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Requirement 1: Add Employee Button */}
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Requirement 5: Search Employees */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, role, email, phone, dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Requirement 6: Filter by Active/Inactive */}
            <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({totalEmployeesCount})
              </button>
              <button
                onClick={() => setStatusFilter("Active")}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  statusFilter === "Active"
                    ? "bg-white text-emerald-700 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Active ({activeCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter("Inactive")}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  statusFilter === "Inactive"
                    ? "bg-white text-slate-700 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Inactive ({inactiveCount})</span>
              </button>
            </div>

            {/* Department Filter */}
            {departmentsList.length > 2 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {departmentsList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "all" ? "All Departments" : dept}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="name">Sort: Name</option>
                <option value="salary">Sort: Salary</option>
                <option value="date">Sort: Joining Date</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No employees found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || statusFilter !== "all" || departmentFilter !== "all"
              ? "No team members match your current filter or search criteria. Try adjusting or clearing filters."
              : "No employees registered in the SQLite database yet. Click 'Add Employee' to register your team members."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            {(searchTerm || statusFilter !== "all" || departmentFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setDepartmentFilter("all");
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                Reset filters
              </button>
            )}
            <button
              onClick={openAddModal}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              Add New Employee
            </button>
          </div>
        </div>
      )}

      {/* Requirement 9: Clean, Professional, Mobile-Friendly View Modes */}

      {/* Table View */}
      {filteredEmployees.length > 0 && viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Job Role &amp; Dept</th>
                  <th className="py-3 px-4">Phone &amp; Email</th>
                  <th className="py-3 px-4">Joining Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Salary ($)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmployees.map((emp) => {
                  const isActive = (emp.status || "").toLowerCase() === "active";
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-slate-900 font-bold">{emp.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              EMP-{emp.id.toString().padStart(3, "0")}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Dept */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{emp.role}</div>
                        <div className="text-[11px] text-slate-500">
                          {emp.department || "General"}
                        </div>
                      </td>

                      {/* Contact Info: Phone & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{emp.phone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[170px]" title={emp.email}>
                            {emp.email || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Joining Date */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{emp.joining_date || "—"}</span>
                        </div>
                      </td>

                      {/* Status: Active / Inactive */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{isActive ? "Active" : "Inactive"}</span>
                        </span>
                      </td>

                      {/* Salary */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900">
                          ${(Number(emp.salary) || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ${Math.round((Number(emp.salary) || 0) / 12).toLocaleString()}/mo
                        </div>
                      </td>

                      {/* Actions: Edit & Delete */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Requirement 3: Edit Employee option */}
                          <button
                            onClick={() => openEditModal(emp)}
                            title="Edit Employee"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {/* Requirement 4: Delete Employee option */}
                          <button
                            onClick={() => setDeletingEmployee(emp)}
                            title="Delete Employee"
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card View (Mobile-Optimized Grid) */}
      {filteredEmployees.length > 0 && viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const isActive = (emp.status || "").toLowerCase() === "active";
            return (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top card bar with avatar & status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{emp.name}</h4>
                        <div className="text-[10px] text-slate-400 font-mono">
                          EMP-{emp.id.toString().padStart(3, "0")}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      <span>{isActive ? "Active" : "Inactive"}</span>
                    </span>
                  </div>

                  {/* Role & Department */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-800">{emp.role}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{emp.department || "General"}</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{emp.phone || "No phone provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{emp.email || "No email"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Joined: {emp.joining_date || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar: Salary + Edit/Delete actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Salary</div>
                    <div className="text-xs font-bold text-slate-900">
                      ${(Number(emp.salary) || 0).toLocaleString()}
                      <span className="text-[10px] text-slate-400 font-normal"> /yr</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(emp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeletingEmployee(emp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: ADD EMPLOYEE ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Employee</h3>
                  <p className="text-[11px] text-slate-500">
                    Saves permanently in SQLite database (`business.db`)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              {/* Field 1: Employee Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Miller"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Field 2 & Department: Job Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Role / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Specialist"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    <option value="Sales & Billing">Sales &amp; Billing</option>
                    <option value="Operations">Operations</option>
                    <option value="Warehouse & Logistics">Warehouse &amp; Logistics</option>
                    <option value="Finance">Finance</option>
                    <option value="Management">Management</option>
                    <option value="Customer Support">Customer Support</option>
                  </select>
                </div>
              </div>

              {/* Field 3 & 4: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. (555) 123-4567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. jordan.m@smartbiz.local"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Field 5 & 6: Salary & Joining Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Annual Salary ($)
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ~${Math.round((parseFloat(formSalary) || 0) / 12).toLocaleString()}/mo
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="45000"
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formJoiningDate}
                    onChange={(e) => setFormJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Field 7: Status (Active / Inactive) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employment Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStatus("Active")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      formStatus === "Active"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Active</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStatus("Inactive")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      formStatus === "Inactive"
                        ? "bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-400/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-slate-500" />
                    <span>Inactive</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Saving to SQLite...</span>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Save Employee</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT EMPLOYEE ================= */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Employee: {editingEmployee.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ID: EMP-{editingEmployee.id.toString().padStart(3, "0")} · SQLite Record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              {/* Field 1: Employee Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Field 2 & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Role / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    <option value="Sales & Billing">Sales &amp; Billing</option>
                    <option value="Operations">Operations</option>
                    <option value="Warehouse & Logistics">Warehouse &amp; Logistics</option>
                    <option value="Finance">Finance</option>
                    <option value="Management">Management</option>
                    <option value="Customer Support">Customer Support</option>
                  </select>
                </div>
              </div>

              {/* Field 3 & 4: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Field 5 & 6: Salary & Joining Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Annual Salary ($)
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ~${Math.round((parseFloat(formSalary) || 0) / 12).toLocaleString()}/mo
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formJoiningDate}
                    onChange={(e) => setFormJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Field 7: Status Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employment Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStatus("Active")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      formStatus === "Active"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Active</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStatus("Inactive")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      formStatus === "Inactive"
                        ? "bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-400/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-slate-500" />
                    <span>Inactive</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Saving to SQLite...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Update Employee</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deletingEmployee && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Employee?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-800">{deletingEmployee.name}</span>?
                This record will be permanently removed from SQLite database (`business.db`).
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1 border border-slate-200/80">
              <div>
                <span className="text-slate-400">Job Role:</span> {deletingEmployee.role}
              </div>
              <div>
                <span className="text-slate-400">Department:</span>{" "}
                {deletingEmployee.department || "General"}
              </div>
              <div>
                <span className="text-slate-400">Record ID:</span> EMP-
                {deletingEmployee.id.toString().padStart(3, "0")}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <span>Deleting...</span> : <span>Yes, Delete</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
