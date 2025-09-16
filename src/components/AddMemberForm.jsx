import React, { useState } from 'react';
import {
  User,
  DollarSign,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import api from '../config/api';
import Cookies from 'js-cookie';

const AddMemberForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    money_paid_monthly: '',
    email: '',
    phone: '',
    start_date: new Date().toISOString().split('T')[0],
    wallet_balance: '' // New optional field for wallet balance
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    // First name validation
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    } else if (formData.first_name.trim().length < 2) {
      newErrors.first_name = 'First name must be at least 2 characters';
    } else if (formData.first_name.trim().length > 50) {
      newErrors.first_name = 'First name cannot exceed 50 characters';
    }

    // Last name validation
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    } else if (formData.last_name.trim().length < 2) {
      newErrors.last_name = 'Last name must be at least 2 characters';
    } else if (formData.last_name.trim().length > 50) {
      newErrors.last_name = 'Last name cannot exceed 50 characters';
    }

    // Monthly payment validation
    if (!formData.money_paid_monthly) {
      newErrors.money_paid_monthly = 'Monthly payment is required';
    } else {
      const amount = parseFloat(formData.money_paid_monthly);
      if (isNaN(amount) || amount < 0) {
        newErrors.money_paid_monthly = 'Please enter a valid payment amount (non-negative)';
      } else if (amount > 10000) {
        newErrors.money_paid_monthly = 'Payment amount cannot exceed $10,000';
      }
    }

    // Initial Wallet Balance validation (optional)
    if (formData.wallet_balance.trim()) {
      const balanceAmount = parseFloat(formData.wallet_balance);
      if (isNaN(balanceAmount) || balanceAmount < 0) {
        newErrors.wallet_balance = 'Please enter a valid non-negative balance amount';
      } else if (balanceAmount > 100000) { // Example maximum balance
        newErrors.wallet_balance = 'Balance amount cannot exceed $100,000';
      }
    }

    // Email validation (optional but if provided, must be valid)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    // Phone validation (optional but if provided, must be valid)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^\+?[\d\s]{10,}$/;
      if (!phoneRegex.test(formData.phone.trim())) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    }

    // Date validation
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    } else {
      const selectedDate = new Date(formData.start_date);
      const today = new Date();
      // Clear time components for accurate comparison
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);

      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(today.getFullYear() + 1);
      oneYearFromNow.setHours(0, 0, 0, 0); // Clear time components

      if (selectedDate > oneYearFromNow) {
        newErrors.start_date = 'Start date cannot be more than one year in the future';
      } else if (selectedDate < new Date('2000-01-01')) { // Arbitrary past date limit
        newErrors.start_date = 'Start date cannot be before 2000';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Handle number input formatting for money_paid_monthly and wallet_balance
    let processedValue = value;
    if (name === 'money_paid_monthly' || name === 'wallet_balance') {
      // Remove any non-numeric characters except decimal point
      processedValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = processedValue.split('.');
      if (parts.length > 2) {
        processedValue = parts[0] + '.' + parts.slice(1).join('');
      }
      // Limit to 2 decimal places if a decimal exists
      if (parts[1] && parts[1].length > 2) {
        processedValue = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async () => {
    // Clear any previous submit errors
    setErrors(prev => ({ ...prev, submit: '' }));

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for API
      const memberData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        money_paid_monthly: parseFloat(formData.money_paid_monthly),
        wallet_balance:parseFloat(formData.wallet_balance)
      };

      // Conditionally add optional fields if they have values
      if (formData.email.trim()) {
        memberData.email = formData.email.trim();
      }
      if (formData.phone.trim()) {
        memberData.phone = formData.phone.trim();
      }
      if (formData.start_date) {
        memberData.start_date = formData.start_date; // Already in YYYY-MM-DD format
      }
      if (formData.wallet_balance.trim()) {
        const parsedBalance = parseFloat(formData.wallet_balance);
        if (!isNaN(parsedBalance) && parsedBalance >= 0) {
          memberData.wallet_balance = parsedBalance;
        }
      }
      
      console.log('Submitting member data:', memberData);

      // Get CSRF token and make request
      await api.get('sanctum/csrf-cookie');

     

      const response = await api.post('/api/members/store', memberData);

      console.log('API Response:', response);

      // Handle different response scenarios
      let result;
      if (response.data) {
        result = response.data;
      } else if (response.status === 201 || response.status === 200) {
        // Success even without data in response.data
        result = {
          success: true,
          member: memberData,
          message: 'Member created successfully'
        };
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }

      console.log('Processed result:', result);

      // Show success state
      setShowSuccess(true);

      // Call success callback after a delay
      setTimeout(() => {
        try {
          onSuccess && onSuccess(result);
          onClose && onClose();
        } catch (callbackError) {
          console.error('Error in success callback:', callbackError);
          // Still close the form even if callback fails
          onClose && onClose();
        }
      }, 1500);

    } catch (error) {
      console.error('Error creating member:', error);

      // Handle different types of errors
      let errorMessage = 'Failed to create member. Please try again.';

      if (error.response) {
        // API responded with error status
        console.log('Error response:', error.response);

        if (error.response.status === 422) {
          // Validation errors from server
          if (error.response.data && error.response.data.errors) {
            setErrors(error.response.data.errors);
            errorMessage = 'Please correct the validation errors below.';
          } else {
            errorMessage = 'Invalid data provided. Please check your inputs.';
          }
        } else if (error.response.status === 401) {
          errorMessage = 'Authentication failed. Please refresh the page and try again.';
        } else if (error.response.status === 403) {
          errorMessage = 'You do not have permission to create members.';
        } else if (error.response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.request) {
        // Request made but no response received
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        // Other errors
        errorMessage = error.message;
      }

      setErrors(prev => ({
        ...prev,
        submit: errorMessage
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPaymentTier = (amount) => {
    const value = parseFloat(amount) || 0;
    if (value >= 100) return { name: 'Premium', color: 'text-green-600' };
    if (value >= 50) return { name: 'Standard', color: 'text-yellow-600' };
    if (value > 0) return { name: 'Basic', color: 'text-orange-600' };
    return { name: 'Unpaid', color: 'text-red-600' };
  };

  const paymentTier = getPaymentTier(formData.money_paid_monthly);

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Member Added Successfully!</h3>
            <p className="text-sm text-gray-500">
              {formData.first_name} {formData.last_name} has been added to your members list.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Add New Member</h2>
                <p className="text-sm text-gray-500">Enter member details and monthly payment information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Error Alert */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-sm text-red-800">{errors.submit}</span>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="w-5 h-5 text-gray-400 mr-2" />
              Personal Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  maxLength={50}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.first_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter first name"
                />
                {errors.first_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  maxLength={50}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.last_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter last name"
                />
                {errors.last_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="member@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="+1 (123) 456-7890"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Membership Start Date *
                </label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.start_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.start_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
              Payment Information
            </h3>

            <div>
              <label htmlFor="money_paid_monthly" className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Payment Amount *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text" // Using text to allow custom formatting via onChange
                  id="money_paid_monthly"
                  name="money_paid_monthly"
                  value={formData.money_paid_monthly}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.money_paid_monthly ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {errors.money_paid_monthly && (
                <p className="mt-1 text-sm text-red-600">{errors.money_paid_monthly}</p>
              )}
              {formData.money_paid_monthly && !errors.money_paid_monthly && (
                <p className="mt-1 text-sm text-gray-500">
                  Payment Tier: <span className={`font-medium ${paymentTier.color}`}>{paymentTier.name}</span>
                </p>
              )}
            </div>

            {/* New: Initial Wallet Balance */}
            <div>
              <label htmlFor="wallet_balance" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Wallet Balance (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text" // Using text to allow custom formatting via onChange
                  id="wallet_balance"
                  name="wallet_balance"
                  value={formData.wallet_balance}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.wallet_balance ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {errors.wallet_balance && (
                <p className="mt-1 text-sm text-red-600">{errors.wallet_balance}</p>
              )}
            </div>


            {/* Payment Tier Guide */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Tiers</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-100 rounded-full"></div>
                  <span className="text-gray-600">Premium: $100+</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-100 rounded-full"></div>
                  <span className="text-gray-600">Standard: $50-$99</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-100 rounded-full"></div>
                  <span className="text-gray-600">Basic: $1-$49</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-100 rounded-full"></div>
                  <span className="text-gray-600">Unpaid: $0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Member...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Member
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMemberForm;
