import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Wallet, Calendar, Plus, Minus, CheckCircle, XCircle, DollarSign, CreditCard, Clock, Loader2, Check, AlertCircle, Home, ChevronRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import api from '../config/api';
import Cookies from 'js-cookie';

// Constants
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const NOTIFICATION_TIMEOUT = 5000;
const PAYMENT_PROCESSING_DELAY = 100; // Still useful for manual month payments to simulate delay/feedback

// Custom hooks
const useNotification = () => {
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    const showNotification = useCallback((type, message) => {
        setNotification({ show: true, type, message });
        setTimeout(() => {
            setNotification({ show: false, type: '', message: '' });
        }, NOTIFICATION_TIMEOUT);
    }, []);

    return { notification, showNotification };
};

const useAsyncState = (initialState = false) => {
    const [loading, setLoading] = useState(initialState);
    const [error, setError] = useState(null);

    const execute = useCallback(async (asyncFunction) => {
        try {
            setLoading(true);
            setError(null);
            return await asyncFunction();
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, error, execute };
};

// Utility functions
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'MAD'
    }).format(amount || 0);
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const getToken = () => {
    const token = Cookies.get('XSRF-TOKEN');
    return token ? decodeURIComponent(token) : null;
};

const createApiHeaders = () => ({
    'X-XSRF-TOKEN': getToken(),
});

export default function MemberDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    // State management
    const [member, setMember] = useState({});
    const [balanceAmount, setBalanceAmount] = useState('');
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [balanceOperation, setBalanceOperation] = useState('add');
    const [paymentLoading, setPaymentLoading] = useState({}); // To track individual month payment loading
    const [isAnyPaymentProcessing, setIsAnyPaymentProcessing] = useState(false); // NEW: Global payment loading state

    // Custom hooks
    const { notification, showNotification } = useNotification();
    const { loading, execute: executeAsync } = useAsyncState(true); // For initial member data fetch
    const { loading: balanceLoading, execute: executeBalanceUpdate } = useAsyncState(); // For balance updates

    // Memoized values
    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const currentMonth = useMemo(() => new Date().getMonth(), []);

    const memberBalance = useMemo(() => parseFloat(member.wallet?.balance || 0), [member.wallet?.balance]);
    const monthlyPayment = useMemo(() => parseFloat(member.money_paid_monthly || 0), [member.money_paid_monthly]);

    const paidMonths = useMemo(() => {
        if (!member.paids) return new Set();
        return new Set(member.paids.map(payment => {
            const date = new Date(payment.payment_date);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }));
    }, [member.paids]);

    const paymentStatus = useMemo(() => {
        return MONTHS.map((month, index) => {
            const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
            const isPaid = paidMonths.has(monthKey);
            const isFuture = index > currentMonth;

            return {
                month,
                isPaid,
                isFuture,
                monthIndex: index,
                monthKey
            };
        });
    }, [currentYear, currentMonth, paidMonths]);

    const paymentSummary = useMemo(() => {
        const paid = paymentStatus.filter(month => month.isPaid && !month.isFuture).length;
        const unpaid = paymentStatus.filter(month => !month.isPaid && !month.isFuture).length;
        const unpaidMonthsCount = paymentStatus.filter(month => !month.isPaid).length; // Still useful general metric

        return {
            paid,
            unpaid,
            unpaidMonthsCount,
            monthsCovered: monthlyPayment > 0 ? Math.floor(memberBalance / monthlyPayment) : 0 // How many months balance could cover
        };
    }, [paymentStatus, memberBalance, monthlyPayment]);

    // NEW: Memoized recent payments, reversed
    const recentPayments = useMemo(() => {
        if (!member.paids || member.paids.length === 0) return [];
        // Create a copy, reverse it, then slice the first 5
        return [...member.paids].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).slice(0, 5);
    }, [member.paids]);

    // API functions
    const fetchMemberData = useCallback(async () => {
        try {
            const response = await api.get(`api/member/${id}`);
            setMember(response.data.member);
        } catch (err) {
            showNotification('error', 'Failed to load member data. Please try again.');
            throw err;
        }
    }, [id, showNotification]);

    const updateMemberBalance = useCallback(async (newBalance) => {
        try {
            await api.put(
                `api/wallet/update-balance/member/${id}`,
                { balance: newBalance },
                { headers: createApiHeaders() }
            );

            setMember(prev => ({
                ...prev,
                wallet: { ...prev.wallet, balance: newBalance }
            }));
        } catch (err) {
            showNotification('error', 'Failed to update balance. Please try again.');
            throw err;
        }
    }, [id, showNotification]);

    const createPayment = useCallback(async (paymentDate, amount) => {
        try {
            const response = await api.post(
                'api/payments',
                {
                    member_id: id,
                    payment_date: paymentDate,
                    balance: amount
                },
                { headers: createApiHeaders() }
            );

            const newPayment = {
                id: response.data?.id || Date.now(),
                payment_date: paymentDate,
                amount: amount,
                member_id: id
            };

            setMember(prev => ({
                ...prev,
                paids: [...(prev.paids || []), newPayment]
            }));

            return newPayment;
        } catch (err) {
            showNotification('error', 'Failed to create payment. Please try again.');
            throw err;
        }
    }, [id, showNotification]);

    // Event handlers
    const handlePayMonth = useCallback(async (monthData) => {
        if (memberBalance < monthlyPayment) {
            showNotification('error', 'Insufficient balance to pay for this month');
            return;
        }

        const { monthKey, monthIndex, month } = monthData;

        // Set global payment loading to true
        setIsAnyPaymentProcessing(true);
        setPaymentLoading(prev => ({ ...prev, [monthKey]: true })); // Still track individual month for spinner

        try {
            const paymentDate = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
            const newBalance = memberBalance - monthlyPayment;

            await createPayment(paymentDate, monthlyPayment);
            await updateMemberBalance(newBalance);

            // Simulate a short delay for better UI feedback (optional)
            await new Promise(resolve => setTimeout(resolve, PAYMENT_PROCESSING_DELAY));

            showNotification('success', `Payment for ${month} processed successfully`);

        } catch (err) {
            // Error already handled in the API functions
        } finally {
            setPaymentLoading(prev => ({ ...prev, [monthKey]: false }));
            // Set global payment loading to false
            setIsAnyPaymentProcessing(false);
        }
    }, [memberBalance, monthlyPayment, currentYear, createPayment, updateMemberBalance, showNotification]);


    const handleBalanceUpdate = useCallback(async () => {
        if (!balanceAmount || isNaN(balanceAmount)) {
            showNotification('error', 'Please enter a valid amount');
            return;
        }

        const amount = parseFloat(balanceAmount);
        const newBalance = balanceOperation === 'add'
            ? memberBalance + amount
            : memberBalance - amount;

        if (newBalance < 0) {
            showNotification('error', 'Insufficient balance for this operation');
            return;
        }

        return executeBalanceUpdate(async () => {
            await updateMemberBalance(newBalance);
            showNotification('success', `Balance ${balanceOperation === 'add' ? 'added' : 'deducted'} successfully`);
            setBalanceAmount('');
            setShowBalanceModal(false);
        });
    }, [balanceAmount, balanceOperation, memberBalance, executeBalanceUpdate, updateMemberBalance, showNotification]);

    const canPayMonth = useCallback((monthData) => {
        // Also check isAnyPaymentProcessing to disable all pay buttons
        return !isAnyPaymentProcessing &&
               !monthData.isFuture &&
               !monthData.isPaid &&
               memberBalance >= monthlyPayment;
    }, [memberBalance, monthlyPayment, isAnyPaymentProcessing]); // Added isAnyPaymentProcessing to dependencies

    // Effects
    useEffect(() => {
        executeAsync(fetchMemberData);
    }, [executeAsync, fetchMemberData]);

    // Components
    const LoadingSpinner = ({ size = 'md' }) => {
        const sizeClasses = {
            sm: 'w-4 h-4',
            md: 'w-6 h-6',
            lg: 'w-8 h-8',
            xl: 'w-12 h-12'
        };

        return (
            <div className="flex items-center justify-center">
                <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
            </div>
        );
    };

    const Notification = () => {
        if (!notification.show) return null;

        return (
            <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
                <div className={`flex items-center p-4 rounded-lg shadow-lg max-w-md ${
                    notification.type === 'success'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                }`}>
                    {notification.type === 'success' ? (
                        <Check className="w-5 h-5 text-green-600 mr-3" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                    )}
                    <p className={`text-sm font-medium ${
                        notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                        {notification.message}
                    </p>
                </div>
            </div>
        );
    };

    const BalanceModal = () => {
        if (!showBalanceModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Wallet Balance</h3>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Balance: {formatCurrency(memberBalance)}
                        </label>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Operation</label>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setBalanceOperation('add')}
                                // Disable balance management if balance is loading OR any payment is processing
                                disabled={balanceLoading || isAnyPaymentProcessing}
                                className={`flex items-center px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                                    balanceOperation === 'add'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add
                            </button>
                            <button
                                onClick={() => setBalanceOperation('subtract')}
                                // Disable balance management if balance is loading OR any payment is processing
                                disabled={balanceLoading || isAnyPaymentProcessing}
                                className={`flex items-center px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                                    balanceOperation === 'subtract'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                <Minus className="w-4 h-4 mr-1" />
                                Subtract
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                        <input
                            type="number"
                            value={balanceAmount}
                            onChange={(e) => setBalanceAmount(e.target.value)}
                            // Disable if balance is loading OR any payment is processing
                            disabled={balanceLoading || isAnyPaymentProcessing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Enter amount"
                            min="0"
                            step="0.01"
                        />
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => setShowBalanceModal(false)}
                            // Disable if balance is loading OR any payment is processing
                            disabled={balanceLoading || isAnyPaymentProcessing}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBalanceUpdate}
                            // Disable if balance is loading OR any payment is processing
                            disabled={balanceLoading || isAnyPaymentProcessing}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-w-[120px] justify-center"
                        >
                            {balanceLoading ? (
                                <>
                                    <LoadingSpinner size="sm" />
                                    <span className="ml-2">Updating...</span>
                                </>
                            ) : (
                                'Update Balance'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner size="xl" />
                    <p className="mt-4 text-gray-600">Loading member details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Notification />

            {/* Header Navigation */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                                <Home className="w-5 h-5" />
                                <span className="font-medium">Home</span>
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-800 font-medium">Member Details</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Current Member</p>
                                <p className="font-semibold text-gray-900">
                                    {`${member.first_name || ''} ${member.last_name || ''}`}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {member.first_name} {member.last_name}
                                </h1>
                                <p className="text-gray-600">Member ID: {member.id}</p>
                                <p className="text-gray-600">Member since: {formatDate(member.created_at)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600">Monthly Payment</p>
                            <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(monthlyPayment)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Wallet Section */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <Wallet className="w-5 h-5 mr-2" />
                                    Wallet
                                </h2>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setShowBalanceModal(true)}
                                        // Disable balance management if any payment is processing
                                        disabled={balanceLoading || isAnyPaymentProcessing}
                                        className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        {balanceLoading ? (
                                            <LoadingSpinner size="sm" />
                                        ) : (
                                            'Manage'
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white mb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-100 text-sm">Current Balance</p>
                                        <p className="text-2xl font-bold">
                                            {formatCurrency(memberBalance)}
                                        </p>
                                    </div>
                                    <CreditCard className="w-8 h-8 text-blue-200" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-sm text-gray-600">Monthly Rate</span>
                                    <span className="font-medium">{formatCurrency(monthlyPayment)}</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-sm text-gray-600">Months Covered</span>
                                    <span className="font-medium">{paymentSummary.monthsCovered} months</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <Calendar className="w-5 h-5 mr-2" />
                                Payment Summary
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <div className="flex items-center">
                                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                                        <div>
                                            <p className="text-sm text-gray-600">Paid</p>
                                            <p className="text-xl font-bold text-green-600">{paymentSummary.paid}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-red-50 p-3 rounded-lg">
                                    <div className="flex items-center">
                                        <XCircle className="w-5 h-5 text-red-600 mr-2" />
                                        <div>
                                            <p className="text-sm text-gray-600">Unpaid</p>
                                            <p className="text-xl font-bold text-red-600">{paymentSummary.unpaid}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Status Grid */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <Clock className="w-5 h-5 mr-2" />
                                Payment Status - {currentYear}
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {paymentStatus.map((month) => (
                                    <div
                                        key={month.monthKey}
                                        className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                                            month.isFuture
                                                ? 'border-gray-200 bg-gray-50'
                                                : month.isPaid
                                                    ? 'border-green-200 bg-green-50'
                                                    : 'border-red-200 bg-red-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="font-medium text-gray-900">{month.month}</p>
                                                <p className="text-sm text-gray-600">
                                                    {formatCurrency(monthlyPayment)}
                                                </p>
                                            </div>
                                            <div className="flex items-center">
                                                {month.isFuture ? (
                                                    <Clock className="w-5 h-5 text-gray-400" />
                                                ) : month.isPaid ? (
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                month.isFuture
                                                    ? 'bg-gray-200 text-gray-600'
                                                    : month.isPaid
                                                        ? 'bg-green-200 text-green-800'
                                                        : 'bg-red-200 text-red-800'
                                            }`}>
                                                {month.isFuture ? 'Future' : month.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>

                                            {/* Disable based on canPayMonth, which now includes isAnyPaymentProcessing */}
                                            {canPayMonth(month) ? (
                                                <button
                                                    onClick={() => handlePayMonth(month)}
                                                    className="text-xs px-2 py-1 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                                >
                                                    {paymentLoading[month.monthKey] ? ( // Show spinner only for the currently processing month
                                                        <LoadingSpinner size="sm" />
                                                    ) : (
                                                        'Pay'
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="text-xs px-2 py-1 rounded-md font-medium bg-gray-200 text-gray-400 cursor-not-allowed"
                                                    title={
                                                        paymentLoading[month.monthKey]
                                                            ? 'Processing...'
                                                            : month.isPaid
                                                                ? 'Already Paid'
                                                                : month.isFuture
                                                                    ? 'Future Month'
                                                                    : isAnyPaymentProcessing
                                                                        ? 'Another payment is processing...' // More specific message
                                                                        : 'Insufficient balance'
                                                    }
                                                >
                                                    {paymentLoading[month.monthKey] ? (
                                                        <LoadingSpinner size="sm" />
                                                    ) : (
                                                        'Pay'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Payments */}
                        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>
                            <div className="space-y-3">
                                {recentPayments.length > 0 ? (
                                    recentPayments.map((payment) => (
                                        <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center">
                                                <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                                                <span className="text-sm text-gray-600">
                                                    Payment for {formatDate(payment.payment_date)}
                                                </span>
                                            </div>
                                            <span className="font-medium text-green-600">
                                                {formatCurrency(payment.amount || member.money_paid_monthly)}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No recent payments found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Balance Management Modal (kept as it's not related to auto-pay) */}
            {showBalanceModal && <BalanceModal />}
        </div>
    );
}