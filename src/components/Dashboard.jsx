import  { useEffect, useState,useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  Mail,
  Users,
  Download,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  X,
  LogOut // Added LogOut icon import
} from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import api from '../config/api';
import AddMemberForm from './AddMemberForm';
import Cookies from 'js-cookie'

const Dashboard = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('first_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Delete operation states
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(0);

  // Bulk delete states
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const token = Cookies.get('XSRF-TOKEN')

   const fetchData = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        search: searchTerm,
        sort_field: sortField,
        sort_direction: sortDirection,
        payment_filter: paymentFilter,
      });

      const response = await api.get(`api/members?${params}`);

      const membersData = response.data.members;
      setUsers(membersData.data || []);
      setCurrentPage(membersData.current_page || 1);
      setLastPage(membersData.last_page || 1);
      setPerPage(membersData.per_page || 10);
      setTotal(membersData.total || 0);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [perPage, searchTerm, sortField, sortDirection, paymentFilter]);

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, perPage, searchTerm, sortField, sortDirection, paymentFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchData(1);
    }
  }, [searchTerm, sortField, sortDirection, paymentFilter,currentPage]);

  // Progress bar animation for single delete
  useEffect(() => {
    if (isDeleting) {
      setDeleteProgress(0);
      const interval = setInterval(() => {
        setDeleteProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isDeleting]);

  // Bulk delete progress bar animation
  useEffect(() => {
    if (isBulkDeleting) {
      setBulkDeleteProgress(0);
      const interval = setInterval(() => {
        setBulkDeleteProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isBulkDeleting]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const deleteMember = async (MemberID) => {
    try {
      setIsDeleting(true);
      setDeleteMessage(null);
      setDeleteProgress(0);

      const response = await api.delete(`/api/member/delete/${MemberID}`, {
        headers: {
          'X-XSRF-TOKEN': decodeURIComponent(token),
        },
        withCredentials: true,
      });

      // Complete the progress bar
      setDeleteProgress(100);

      // Show success message
      const successMessage = response.data?.message || 'Member deleted successfully';
      setDeleteMessage({
        type: 'success',
        text: successMessage
      });

      // Refresh data
      fetchData(currentPage);

    } catch (err) {
      console.error(err);
      setDeleteProgress(100);

      // Show error message
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete member';
      setDeleteMessage({
        type: 'error',
        text: errorMessage
      });
    } finally {
      setIsDeleting(false);

      // Hide message after 5 seconds
      setTimeout(() => {
        setDeleteMessage(null);
        setDeleteProgress(0);
      }, 5000);
    }
  };

  const bulkDeleteMembers = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setIsBulkDeleting(true);
      setDeleteMessage(null);
      setBulkDeleteProgress(0);

      const response = await api.post('api/members/bulk-delete', {
        member_ids: selectedUsers
      }, {
        headers: {
          'X-XSRF-TOKEN': decodeURIComponent(token),
        },
      });

      // Complete the progress bar
      setBulkDeleteProgress(100);

      // Show success message
      const successMessage = response.data?.message || `${selectedUsers.length} members deleted successfully`;
      setDeleteMessage({
        type: 'success',
        text: successMessage
      });

      // Clear selected users and refresh data
      setSelectedUsers([]);
      fetchData(currentPage);

    } catch (err) {
      console.error(err);
      setBulkDeleteProgress(100);

      // Show error message
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete selected members';
      setDeleteMessage({
        type: 'error',
        text: errorMessage
      });
    } finally {
      setIsBulkDeleting(false);

      // Hide message after 5 seconds
      setTimeout(() => {
        setDeleteMessage(null);
        setBulkDeleteProgress(0);
      }, 5000);
    }
  };

  const confirmDelete = (MemberID) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    deleteMember(MemberID);
  };

  const confirmBulkDelete = () => {
    if (selectedUsers.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedUsers.length} selected member${selectedUsers.length > 1 ? 's' : ''}? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;
    bulkDeleteMembers();
  };

  const dismissMessage = () => {
    setDeleteMessage(null);
    setDeleteProgress(0);
    setBulkDeleteProgress(0);
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length && users.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.id));
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= lastPage) {
      setCurrentPage(page);
    }
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  // NEW: Logout handler
  const handleLogout = async () => {
    try {
      // Assuming your backend has a /logout endpoint that invalidates the session
      await api.post('/logout', {}, {
        headers: {
          'X-XSRF-TOKEN': decodeURIComponent(Cookies.get('XSRF-TOKEN')),
        },
        withCredentials: true, // Important for sending session cookies
      });
      // Clear the XSRF token cookie and any other local auth state
      Cookies.remove('XSRF-TOKEN');
      // Redirect to login page or home page
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout API call fails, clear local state and redirect for security
      Cookies.remove('XSRF-TOKEN');
      navigate('/login');
    }
  };


  const getPaymentStatusColor = (amount) => {
    if (amount >= 100) return 'bg-green-100 text-green-800';
    if (amount >= 50) return 'bg-yellow-100 text-yellow-800';
    if (amount > 0) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getPaymentStatus = (amount) => {
    if (amount >= 100) return 'Premium';
    if (amount >= 50) return 'Standard';
    if (amount > 0) return 'Basic';
    return 'Unpaid';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="w-4 h-4 ml-1" /> :
      <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const generatePaginationButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    const halfMaxButtons = Math.floor(maxButtons / 2);

    let startPage = Math.max(1, currentPage - halfMaxButtons);
    let endPage = Math.min(lastPage, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(<span key="start-ellipsis" className="px-2 text-gray-500">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-2 text-sm border border-gray-300 rounded-lg ${
            i === currentPage
              ? 'bg-blue-600 text-white border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }

    if (endPage < lastPage) {
      if (endPage < lastPage - 1) {
        buttons.push(<span key="end-ellipsis" className="px-2 text-gray-500">...</span>);
      }
      buttons.push(
        <button
          key={lastPage}
          onClick={() => handlePageChange(lastPage)}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {lastPage}
        </button>
      );
    }

    return buttons;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* NEW: Dashboard Header with Logout */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Member Dashboard</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Progress Bar */}
        {(isDeleting || deleteProgress > 0 || isBulkDeleting || bulkDeleteProgress > 0) && (
          <div className="fixed top-0 left-0 right-0 z-50">
            <div className="h-1 bg-gray-200">
              <div
                className="h-1 bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(deleteProgress, bulkDeleteProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Success/Error Message */}
        {deleteMessage && (
          <div className={`fixed top-4 right-4 z-50 max-w-md rounded-lg shadow-lg border p-4 ${
            deleteMessage.type === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center">
              {deleteMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mr-3" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  deleteMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {deleteMessage.text}
                </p>
              </div>
              <button
                onClick={dismissMessage}
                className={`ml-3 p-1 rounded-full hover:bg-opacity-20 ${
                  deleteMessage.type === 'success'
                    ? 'hover:bg-green-600 text-green-600'
                    : 'hover:bg-red-600 text-red-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Header (Original header content moved here) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Members List</h1> {/* Changed title to avoid redundancy with new top header */}
                  <p className="text-sm text-gray-500">Manage your members and their monthly payments</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
                <button className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </button>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </button>
                <button
                  onClick={() => fetchData(currentPage)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {selectedUsers.length > 0 && (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {selectedUsers.length} selected
                  </span>
                  <button
                    onClick={confirmBulkDelete}
                    disabled={isBulkDeleting}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBulkDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                  </button>
                </div>
              )}
            </div>

            {/* Filter Controls */}
            {showFilters && (
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Payment Tier:</label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Tiers</option>
                    <option value="premium">Premium ($100+)</option>
                    <option value="standard">Standard ($50-$99)</option>
                    <option value="basic">Basic ($1-$49)</option>
                    <option value="unpaid">Unpaid ($0)</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Per Page:</label>
                  <select
                    value={perPage}
                    onChange={(e) => handlePerPageChange(Number(e.target.value))}
                    className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Member
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center">
                      Email
                      <SortIcon field="email" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('money_paid_monthly')}
                  >
                    <div className="flex items-center">
                      Monthly Payment
                      <SortIcon field="money_paid_monthly" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center">
                      Member Since
                      <SortIcon field="created_at" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
                        <span className="text-gray-500">Loading members...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="text-red-500">
                        <p className="font-medium">Error loading members</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="font-medium">No members found</p>
                        <p className="text-sm">Get started by adding your first member.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {getInitials(user.first_name, user.last_name)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">Member ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 text-green-600 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(user.money_paid_monthly || 0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(user.money_paid_monthly || 0)}`}>
                          {getPaymentStatus(user.money_paid_monthly || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.created_at ? formatDate(user.created_at) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={(e)=>{e.preventDefault();
                          // Use backticks for template literal string for cleaner URL
                          navigate(`/member-details/${user.id}`); // Assuming `id` is the correct parameter for details page
                          }} className="text-blue-600 hover:text-blue-900 p-1 rounded">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900 p-1 rounded">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900 p-1 rounded">
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              confirmDelete(user.id);
                            }}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-900 p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

         {/* Pagination */}
        <div className="bg-white px-6 py-4 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {users.length === 0 ? 0 : ((currentPage - 1) * perPage) + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(currentPage * perPage, total)}
              </span>{' '}
              of{' '}
              <span className="font-medium">{total}</span>{' '}
              results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>

              {generatePaginationButtons()}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === lastPage}
                className="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Form Modal */}
      {showAddForm && (
        <AddMemberForm
          onClose={() => setShowAddForm(false)}
          onSuccess={(newMember) => {
            fetchData(currentPage);
            setShowAddForm(false);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
