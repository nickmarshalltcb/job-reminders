import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCalendarAlt,
  FaBell,
  FaSearch,
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
  FaTrash,
  FaCog,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaTimes,
  FaPlus,
  FaFilter,
  FaChevronDown,
  FaChevronUp,
  FaCalendar,
  FaUser,
  FaEdit,
  FaPlay,
  FaPause,
  FaRedo,
} from 'react-icons/fa';
import { supabase } from './supabaseClient';
import {
  logEvent,
  logError,
  logSystemStartup,
  logAuthEvent,
  logJobOperation,
  logEmailOperation,
  logReminderOperation,
  logSystemError,
  logCriticalError
} from './utils/discordLogger.js';
import { JobCard } from './components/JobCard';

interface Job {
  id: number;
  jobNumber: string;
  clientName: string;
  forwardingDate: string;
  productionDeadline: string;
  status: string;
  reminderSent: boolean;
  snoozedUntil: string | null; // Legacy field (kept for backward compatibility)
  snoozeExpiresAt: string | null; // New timestamp field for precise snooze handling
  lastReminderDate: string | null; // Legacy field (kept for backward compatibility)
  lastReminderSentAt: string | null; // New timestamp field for precise tracking
  createdAt: string;
}

interface Session {
  user: any;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type: string;
}

const JobReminderSystem = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'daysLeft', direction: 'asc' });
  const [emailConfig, setEmailConfig] = useState({
    toEmail: '',
    fromEmail: '',
    fromPassword: '',
    configured: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
    undoAction?: () => void;
    undoLabel?: string;
  }>({
    show: false,
    message: '',
    type: 'success',
    undoAction: undefined,
    undoLabel: undefined
  });
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isEmailConfigLoading, setIsEmailConfigLoading] = useState(false);
  const [isEmailConfigSaving, setIsEmailConfigSaving] = useState(false);
  const [emailConfigErrors, setEmailConfigErrors] = useState({
    toEmail: '',
    fromEmail: '',
    fromPassword: ''
  });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning';
  } | null>(null);

  // Bulk selection state
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  // Paste preview state
  const [pastePreview, setPastePreview] = useState<{
    show: boolean;
    jobs: Job[];
    duplicates: Job[];
    unique: Job[];
  }>({
    show: false,
    jobs: [],
    duplicates: [],
    unique: []
  });

  // Loading states for all async operations
  const [loadingStates, setLoadingStates] = useState({
    signIn: false,
    signUp: false,
    signOut: false,
    loadJobs: false,
    saveEmailConfig: false,
    sendTestEmail: false,
    checkReminders: false,
    checkMissedReminders: false,
    sendEmailReminder: false,
    deleteJob: false,
    snoozeReminder: false,
    markAsComplete: false,
    exportData: false,
    pasteJobs: false,
    bulkDelete: false,
    bulkComplete: false,
    bulkRemind: false
  });

  // Helper function to update loading states
  const setLoading = (key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  // Enterprise Tooltip Component with Smart Positioning
  const Tooltip = ({ children, content, id, position = 'top' }: { children: React.ReactNode; content: string; id: string; position?: 'top' | 'bottom' }) => {
    return (
      <div className="relative inline-block group">
        {children}
        {position === 'top' ? (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 text-xs font-medium rounded-lg shadow-2xl z-[60] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none bg-slate-800 text-slate-100 border border-slate-600">
            {content}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 rotate-45 bg-slate-800 border-r border-b border-slate-600"></div>
            </div>
          </div>
        ) : (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 px-3 py-2 text-xs font-medium rounded-lg shadow-2xl z-[60] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none bg-slate-800 text-slate-100 border border-slate-600">
            {content}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-px">
              <div className="w-2 h-2 rotate-45 bg-slate-800 border-l border-t border-slate-600"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper function to get current Pakistan time
  const getPakistanTime = () => {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Track if we've already logged startup to prevent excessive logging
  const [startupLogged, setStartupLogged] = useState(false);

  useEffect(() => {
    if (session && !startupLogged) {
      loadJobs();
      loadEmailConfig(); // Now async
      // Note: Automated reminders are now handled 100% server-side via Netlify scheduled function
      // The function auto-reminder-check.js runs every 5 minutes and sends reminders at 9:00 AM PKT
      // No need for frontend time-based checking
      logSystemStartup(); // Log system startup only once
      setStartupLogged(true);
    }
  }, [session, startupLogged]);

  // Close snooze menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSnoozeMenu && !(event.target as Element).closest('.snooze-menu-container')) {
        setShowSnoozeMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSnoozeMenu]);

  const handleSignIn = async () => {
    try {
      setLoading('signIn', true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showAlert('Login successful', 'success');
      await logAuthEvent('sign in', true, { email });
    } catch (error) {
      showAlert(error.error_description || error.message, 'error');
      await logAuthEvent('sign in', false, { email, error: error.message });
    } finally {
      setLoading('signIn', false);
    }
  };

  const handleSignUp = async () => {
    try {
      setLoading('signUp', true);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showAlert('Check your email for the confirmation link!', 'success');
      await logAuthEvent('sign up', true, { email });
    } catch (error) {
      showAlert(error.error_description || error.message, 'error');
      await logAuthEvent('sign up', false, { email, error: error.message });
    } finally {
      setLoading('signUp', false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading('signOut', true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showAlert('Logged out successfully', 'success');
      await logAuthEvent('sign out', true, { email: session?.user?.email });
    } catch (error) {
      showAlert(error.error_description || error.message, 'error');
      await logAuthEvent('sign out', false, { email: session?.user?.email, error: error.message });
    } finally {
      setLoading('signOut', false);
    }
  };

  const loadJobs = async () => {
    setIsLoading(true);
    setLoading('loadJobs', true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('production_deadline', { ascending: true });

      if (error) throw error;

      const formattedJobs = data.map(job => ({
        id: job.id,
        jobNumber: job.job_number,
        clientName: job.client_name,
        forwardingDate: job.forwarding_date,
        productionDeadline: job.production_deadline,
        status: job.status,
        reminderSent: job.reminder_sent,
        snoozedUntil: job.snoozed_until,
        snoozeExpiresAt: job.snooze_expires_at,
        lastReminderDate: job.last_reminder_date,
        lastReminderSentAt: job.last_reminder_sent_at,
        createdAt: job.created_at
      }));

      setJobs(formattedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      showAlert('Failed to load jobs', 'error');
      await logSystemError(error, { operation: 'loadJobs' });
    } finally {
      setIsLoading(false);
      setLoading('loadJobs', false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateEmailAvailability = async (email: string): Promise<boolean> => {
    try {
      // Check if it's a valid Gmail address for the sender
      if (email.includes('@gmail.com')) {
        return true; // Assume Gmail addresses are available
      }
      
      // For other email providers, we can add more sophisticated validation
      // For now, just validate the format
      return validateEmail(email);
    } catch (error) {
      console.error('Error validating email availability:', error);
      return false;
    }
  };

  const validateEmailConfig = () => {
    const errors = {
      toEmail: '',
      fromEmail: '',
      fromPassword: ''
    };

    if (!emailConfig.toEmail) {
      errors.toEmail = 'Recipient email is required';
    } else if (!validateEmail(emailConfig.toEmail)) {
      errors.toEmail = 'Please enter a valid email address';
    }

    if (!emailConfig.fromEmail) {
      errors.fromEmail = 'Sender email is required';
    } else if (!validateEmail(emailConfig.fromEmail)) {
      errors.fromEmail = 'Please enter a valid email address';
    }

    if (!emailConfig.fromPassword) {
      errors.fromPassword = 'App password is required';
    } else if (emailConfig.fromPassword.length < 8) {
      errors.fromPassword = 'App password must be at least 8 characters';
    }

    setEmailConfigErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  const loadEmailConfig = async () => {
    try {
      if (!session?.access_token) return;
      
      setIsEmailConfigLoading(true);
      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `${window.location.protocol}//${window.location.hostname}:8888`
        : window.location.origin;
      const response = await fetch(`${baseUrl}/.netlify/functions/email-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          method: 'GET'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.emailConfig) {
          setEmailConfig({
            toEmail: result.emailConfig.to_email,
            fromEmail: result.emailConfig.from_email,
            fromPassword: result.emailConfig.from_password,
            configured: result.emailConfig.configured
          });
        }
      } else {
        // If table doesn't exist, that's okay - user hasn't configured email yet
        console.log('Email configuration not found - user needs to set it up');
      }
    } catch (error) {
      console.error('Error loading email config:', error);
      // Don't show error to user if table doesn't exist yet
    } finally {
      setIsEmailConfigLoading(false);
    }
  };

  const saveEmailConfig = async () => {
    try {
      if (!validateEmailConfig()) {
        showAlert('Please fix the validation errors before saving', 'warning');
        return;
      }
      
      if (!session?.access_token) {
        showAlert('You must be logged in to save email configuration', 'warning');
        return;
      }

      setIsEmailConfigSaving(true);
      setLoading('saveEmailConfig', true);
      setEmailConfigErrors({ toEmail: '', fromEmail: '', fromPassword: '' });

      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `${window.location.protocol}//${window.location.hostname}:8888`
        : window.location.origin;
      const response = await fetch(`${baseUrl}/.netlify/functions/email-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          method: 'SAVE',
          emailConfig: {
            toEmail: emailConfig.toEmail,
            fromEmail: emailConfig.fromEmail,
            fromPassword: emailConfig.fromPassword,
            configured: true
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEmailConfig(prev => ({ ...prev, configured: true }));
          showAlert('Email configuration saved successfully!', 'success');
          await logEmailOperation('save configuration', { configured: true });
        } else {
          showAlert(result.error || 'Failed to save email configuration', 'error');
        }
      } else {
        const errorResult = await response.json();
        showAlert(errorResult.error || 'Failed to save email configuration', 'error');
      }
    } catch (error) {
      console.error('Error saving email config:', error);
      
      if (error.name === 'AbortError') {
        showAlert('Request timed out. Please check your connection and try again.', 'error');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showAlert('Network error. Please check your connection and try again.', 'error');
      } else {
        showAlert(`Failed to save email configuration: ${error.message}`, 'error');
      }
      
      await logEmailOperation('save configuration', { error: error.message }, false);
    } finally {
      setIsEmailConfigSaving(false);
      setLoading('saveEmailConfig', false);
    }
  };

  const sendTestEmail = async () => {
    if (!emailConfig.toEmail || !emailConfig.fromEmail || !emailConfig.fromPassword) {
      showAlert('Please fill in all email configuration fields first', 'warning');
      return;
    }

    try {
      setLoading('sendTestEmail', true);
      showAlert('Sending test email...', 'success');

      // Create a test job
      const testJob = {
        id: 1,
        jobNumber: 'TEST-001',
        clientName: 'Test Client',
        forwardingDate: new Date().toISOString().split('T')[0],
        productionDeadline: new Date().toISOString().split('T')[0],
        status: 'In Production'
      };

      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `${window.location.protocol}//${window.location.hostname}:8888`
        : window.location.origin;
      const response = await fetch(`${baseUrl}/.netlify/functions/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs: [testJob],
          emailConfig,
          isBundled: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send test email`);
      }

      await response.json();

      showAlert('Test email sent successfully! Check your inbox.', 'success');
      await logEmailOperation('send test email', { recipientCount: 1 }, true);
    } catch (error) {
      showAlert(`Failed to send test email: ${error.message}`, 'error');
      await logEmailOperation('send test email', { error: error.message }, false);
    } finally {
      setLoading('sendTestEmail', false);
    }
  };

  // REMOVED: Frontend time-based reminder checking
  // Reminders are now 100% server-side via auto-reminder-check.js
  // This function is kept only for manual testing if needed
  const checkReminders = async () => {
    // No-op: All automated reminders are handled server-side
    console.log('Note: Automated reminders are handled server-side at 9:00 AM PKT');
  };

  const checkMissedReminders = async () => {
    if (!emailConfig.configured) {
      return;
    }

    try {
      setLoading('checkMissedReminders', true);
      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `${window.location.protocol}//${window.location.hostname}:8888`
        : window.location.origin;
      const response = await fetch(`${baseUrl}/.netlify/functions/check-missed-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailConfig
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.missedCount > 0) {
          await logReminderOperation('check missed reminders', { 
            missedCount: result.missedCount,
            sentCount: result.sentCount
          }, true);
        }
      }
    } catch (error) {
      console.error('Error checking missed reminders:', error);
      await logReminderOperation('check missed reminders', { error: error.message }, false);
    } finally {
      setLoading('checkMissedReminders', false);
    }
  };

  const sendEmailReminder = async (jobs: Job | Job[]) => {
    if (!emailConfig.configured) {
      return;
    }

    try {
      setLoading('sendEmailReminder', true);
      const jobList = Array.isArray(jobs) ? jobs : [jobs];
      
      // Send email via Netlify Function
      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `${window.location.protocol}//${window.location.hostname}:8888`
        : window.location.origin;
      const response = await fetch(`${baseUrl}/.netlify/functions/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobs: jobList,
          emailConfig,
          isBundled: jobList.length > 1
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email reminder');
      }

      // Update database to mark reminder as sent for all jobs
      for (const job of jobList) {
        await supabase
          .from('jobs')
          .update({
            reminder_sent: true,
            last_reminder_date: new Date().toISOString(),
            snoozed_until: null
          })
          .eq('job_number', job.jobNumber);
      }

      await loadJobs();
      await logEmailOperation('send reminder', { 
        jobCount: jobList.length, 
        recipientCount: 1,
        jobNumbers: jobList.map(j => j.jobNumber),
        isBundled: jobList.length > 1
      }, true);
      
    } catch (error) {
      console.error('Error sending email reminder:', error);
      showAlert('Failed to send email reminder', 'error');
      await logEmailOperation('send reminder', { 
        jobCount: Array.isArray(jobs) ? jobs.length : 1, 
        error: error.message 
      }, false);
    } finally {
      setLoading('sendEmailReminder', false);
    }
  };

  const parseJobData = (text: string): Job[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('Invalid format: No data provided');
    }

    const jobsData: Job[] = [];
    for (let i = 0; i < lines.length; i++) {
      const data = lines[i].split('\t');

      if (data.length !== 5) {
        throw new Error(`Invalid format on row ${i + 1}: Expected 5 tab-separated columns`);
      }

      const convertDate = (dateStr: string): string => {
        // Handle various date formats
        let date: Date;
        
        // Try parsing DD-MMM-YYYY format first (e.g., "15-Oct-2025")
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[1].length === 3) {
          const day = parseInt(parts[0]);
          const month = parts[1];
          const year = parseInt(parts[2]);
          
          // Create date in UTC to avoid timezone issues
          date = new Date(Date.UTC(year, getMonthIndex(month), day));
        } else {
          // Try parsing as-is first
          date = new Date(dateStr);
          
          // If that fails, try DD/MM/YYYY format
        if (isNaN(date.getTime())) {
            date = new Date(dateStr.replace(/\//g, '-'));
          }
        }
        
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${dateStr}. Expected formats: DD-MMM-YYYY, DD/MM/YYYY, or YYYY-MM-DD`);
        }
        
        // Return date in YYYY-MM-DD format without timezone conversion
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Helper function to convert month abbreviation to index
      const getMonthIndex = (monthAbbr: string): number => {
        const months: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        return months[monthAbbr] ?? 0;
      };

      jobsData.push({
        id: Date.now() + i,
        jobNumber: data[0].trim(),
        clientName: data[1].trim(),
        forwardingDate: convertDate(data[2].trim()),
        productionDeadline: convertDate(data[3].trim()),
        status: data[4].trim(),
        reminderSent: false,
        snoozedUntil: null,
        snoozeExpiresAt: null,
        lastReminderDate: null,
        lastReminderSentAt: null,
        createdAt: new Date().toISOString()
      });
    }

    return jobsData;
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    try {
      setLoading('pasteJobs', true);
      const parsedJobs = parseJobData(pastedText);

      // Check for duplicate job numbers
      const existingJobNumbers = jobs.map(job => job.jobNumber);
      const duplicateJobs = parsedJobs.filter(job => existingJobNumbers.includes(job.jobNumber));
      const uniqueJobs = parsedJobs.filter(job => !existingJobNumbers.includes(job.jobNumber));

      // Show preview modal
      setPastePreview({
        show: true,
        jobs: parsedJobs,
        duplicates: duplicateJobs,
        unique: uniqueJobs
      });

    } catch (error) {
      console.error('Error parsing jobs:', error);
      showAlert(error.message, 'error');
    } finally {
      setLoading('pasteJobs', false);
    }
  };

  const confirmPasteJobs = async () => {
    try {
      setLoading('pasteJobs', true);

      // Only insert unique jobs
      const dbJobs = pastePreview.unique.map(job => ({
        job_number: job.jobNumber,
        client_name: job.clientName,
        forwarding_date: job.forwardingDate,
        production_deadline: job.productionDeadline,
        status: job.status,
        reminder_sent: false,
        snoozed_until: null,
        last_reminder_date: null,
        snooze_expires_at: null,
        last_reminder_sent_at: null
      }));

      if (dbJobs.length === 0) {
        showAlert('No unique jobs to add', 'warning');
        setPastePreview({ show: false, jobs: [], duplicates: [], unique: [] });
        return;
      }

      const { error } = await supabase.from('jobs').insert(dbJobs);
      if (error) throw error;

      await loadJobs();
      setInputText('');

      const duplicateCount = pastePreview.duplicates.length;
      const successMessage = duplicateCount > 0
        ? `Added ${dbJobs.length} job(s). Skipped ${duplicateCount} duplicate(s).`
        : `Successfully added ${dbJobs.length} job(s)`;

      showAlert(successMessage, 'success');
      await logJobOperation('bulk insert', {
        jobCount: dbJobs.length,
        duplicateCount,
        jobNumbers: pastePreview.unique.map(j => j.jobNumber)
      }, true);

      setPastePreview({ show: false, jobs: [], duplicates: [], unique: [] });
    } catch (error) {
      console.error('Error adding jobs:', error);
      showAlert(error.message, 'error');
      await logJobOperation('bulk insert', { error: error.message }, false);
    } finally {
      setLoading('pasteJobs', false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const showAlert = (
    message: string,
    type: 'success' | 'error' | 'warning',
    undoAction?: () => void,
    undoLabel: string = 'Undo'
  ) => {
    setNotification({ show: true, message, type, undoAction, undoLabel });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false, undoAction: undefined, undoLabel: undefined }));
    }, 5000); // Extended to 5 seconds for undo actions
  };

  const deleteJob = async (jobNumber: string) => {
    // Show confirmation dialog first
    setConfirmDialog({
      show: true,
      title: 'Delete Job',
      message: `Are you sure you want to delete job ${jobNumber}?`,
      variant: 'danger',
      onConfirm: async () => {
        // Close dialog immediately for better UX
        setConfirmDialog(null);

        // Find and store the job data before deleting
        const jobToDelete = jobs.find(j => j.jobNumber === jobNumber);
        if (!jobToDelete) {
          showAlert('Job not found', 'error');
          return;
        }

        try {
          setLoading('deleteJob', true);
          const { error } = await supabase
            .from('jobs')
            .delete()
            .eq('job_number', jobNumber);

          if (error) throw error;

          await loadJobs();

          // Undo function to restore the deleted job
          const undoDelete = async () => {
            try {
              const dbJob = {
                job_number: jobToDelete.jobNumber,
                client_name: jobToDelete.clientName,
                forwarding_date: jobToDelete.forwardingDate,
                production_deadline: jobToDelete.productionDeadline,
                status: jobToDelete.status,
                reminder_sent: jobToDelete.reminderSent,
                snoozed_until: jobToDelete.snoozedUntil,
                last_reminder_date: jobToDelete.lastReminderDate,
                snooze_expires_at: jobToDelete.snoozeExpiresAt,
                last_reminder_sent_at: jobToDelete.lastReminderSentAt
              };

              const { error: restoreError } = await supabase
                .from('jobs')
                .insert([dbJob]);

              if (restoreError) throw restoreError;

              await loadJobs();
              showAlert('Job restored successfully', 'success');
              await logJobOperation('undo delete', { jobNumber }, true);
            } catch (undoError) {
              console.error('Error restoring job:', undoError);
              showAlert('Failed to restore job', 'error');
            }
          };

          showAlert(`Job ${jobNumber} deleted`, 'success', undoDelete, 'Undo');
          await logJobOperation('delete', { jobNumber }, true);
        } catch (error) {
          console.error('Error deleting job:', error);
          showAlert('Failed to delete job', 'error');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await logJobOperation('delete', { jobNumber, error: errorMessage }, false);
        } finally {
          setLoading('deleteJob', false);
        }
      }
    });
  };

  // Bulk action functions
  const toggleJobSelection = (jobNumber: string) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobNumber)) {
        newSet.delete(jobNumber);
      } else {
        newSet.add(jobNumber);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map(job => job.jobNumber)));
    }
  };

  const bulkDeleteJobs = async () => {
    if (selectedJobs.size === 0) return;

    setConfirmDialog({
      show: true,
      title: 'Bulk Delete Jobs',
      message: `Are you sure you want to delete ${selectedJobs.size} job(s)?`,
      variant: 'danger',
      onConfirm: async () => {
        // Close dialog immediately for better UX
        setConfirmDialog(null);

        // Find and store all job data before deleting
        const jobNumbers = Array.from(selectedJobs);
        const jobsToDelete = jobs.filter(j => jobNumbers.includes(j.jobNumber));

        if (jobsToDelete.length === 0) {
          showAlert('No jobs found to delete', 'error');
          return;
        }

        try {
          setLoading('bulkDelete', true);

          const { error } = await supabase
            .from('jobs')
            .delete()
            .in('job_number', jobNumbers);

          if (error) throw error;

          await loadJobs();

          // Undo function to restore all deleted jobs
          const undoBulkDelete = async () => {
            try {
              const dbJobs = jobsToDelete.map(job => ({
                job_number: job.jobNumber,
                client_name: job.clientName,
                forwarding_date: job.forwardingDate,
                production_deadline: job.productionDeadline,
                status: job.status,
                reminder_sent: job.reminderSent,
                snoozed_until: job.snoozedUntil,
                last_reminder_date: job.lastReminderDate,
                snooze_expires_at: job.snoozeExpiresAt,
                last_reminder_sent_at: job.lastReminderSentAt
              }));

              const { error: restoreError } = await supabase
                .from('jobs')
                .insert(dbJobs);

              if (restoreError) throw restoreError;

              await loadJobs();
              showAlert(`Restored ${jobsToDelete.length} job(s)`, 'success');
              await logJobOperation('undo bulk delete', { count: jobsToDelete.length, jobNumbers }, true);
            } catch (undoError) {
              console.error('Error restoring jobs:', undoError);
              showAlert('Failed to restore jobs', 'error');
            }
          };

          showAlert(`Deleted ${jobNumbers.length} job(s)`, 'success', undoBulkDelete, 'Undo');
          await logJobOperation('bulk_delete', { count: jobNumbers.length, jobNumbers }, true);

          setSelectedJobs(new Set());
          setBulkSelectMode(false);
        } catch (error) {
          console.error('Error bulk deleting jobs:', error);
          showAlert('Failed to delete jobs', 'error');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await logJobOperation('bulk_delete', { count: selectedJobs.size, error: errorMessage }, false);
        } finally {
          setLoading('bulkDelete', false);
        }
      }
    });
  };

  const bulkMarkAsComplete = async () => {
    if (selectedJobs.size === 0) return;

    // Store previous statuses before updating
    const jobNumbers = Array.from(selectedJobs);
    const jobsToComplete = jobs.filter(j => jobNumbers.includes(j.jobNumber));
    const previousStatuses = new Map(jobsToComplete.map(j => [j.jobNumber, j.status]));

    try {
      setLoading('bulkComplete', true);

      const { error } = await supabase
        .from('jobs')
        .update({ status: 'Completed' })
        .in('job_number', jobNumbers);

      if (error) throw error;

      await loadJobs();

      // Undo function to restore previous statuses
      const undoBulkComplete = async () => {
        try {
          // Update each job back to its original status
          for (const [jobNumber, previousStatus] of previousStatuses.entries()) {
            const { error: undoError } = await supabase
              .from('jobs')
              .update({ status: previousStatus })
              .eq('job_number', jobNumber);

            if (undoError) throw undoError;
          }

          await loadJobs();
          showAlert(`Restored ${previousStatuses.size} job(s) status`, 'success');
          await logJobOperation('undo bulk complete', { count: previousStatuses.size, jobNumbers }, true);
        } catch (undoError) {
          console.error('Error restoring job statuses:', undoError);
          showAlert('Failed to restore job statuses', 'error');
        }
      };

      showAlert(`Marked ${jobNumbers.length} job(s) as complete`, 'success', undoBulkComplete, 'Undo');
      await logJobOperation('bulk_complete', { count: jobNumbers.length, jobNumbers }, true);

      setSelectedJobs(new Set());
      setBulkSelectMode(false);
    } catch (error) {
      console.error('Error bulk completing jobs:', error);
      showAlert('Failed to mark jobs as complete', 'error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await logJobOperation('bulk_complete', { count: selectedJobs.size, error: errorMessage }, false);
    } finally {
      setLoading('bulkComplete', false);
    }
  };

  const bulkSendReminders = async () => {
    if (selectedJobs.size === 0) return;

    try {
      setLoading('bulkRemind', true);
      const jobNumbers = Array.from(selectedJobs);
      const jobsToRemind = jobs.filter(job => jobNumbers.includes(job.jobNumber));

      await sendEmailReminder(jobsToRemind);

      setSelectedJobs(new Set());
      setBulkSelectMode(false);
    } catch (error) {
      console.error('Error bulk sending reminders:', error);
      showAlert('Failed to send reminders', 'error');
    } finally {
      setLoading('bulkRemind', false);
    }
  };

  const snoozeReminder = async (job: Job, hours: number) => {
    try {
      setLoading('snoozeReminder', true);

      // Calculate exact snooze expiry time
      const now = new Date();
      const snoozeExpiresAt = new Date(now.getTime() + (hours * 60 * 60 * 1000));

      const { error } = await supabase
        .from('jobs')
        .update({
          snooze_expires_at: snoozeExpiresAt.toISOString(),
          reminder_sent: false, // Reset reminder flag so it can be sent again
          snoozed_until: null // Clear legacy field
        })
        .eq('job_number', job.jobNumber);

      if (error) throw error;

      // Human-readable feedback
      let timeText = '';
      if (hours === 1) {
        timeText = '1 hour';
      } else if (hours === 4) {
        timeText = '4 hours';
      } else if (hours === 24) {
        timeText = '24 hours (tomorrow at 9 AM PKT)';
      } else if (hours === 48) {
        timeText = '48 hours (day after tomorrow at 9 AM PKT)';
      } else if (hours === 168) {
        timeText = '1 week (next week at 9 AM PKT)';
      } else {
        timeText = `${hours} hours`;
      }

      showAlert(`Snoozed for ${timeText}`, 'success');
      setShowSnoozeMenu(null);
      await loadJobs();

      await logReminderOperation('snooze', {
        jobNumber: job.jobNumber,
        clientName: job.clientName,
        hours,
        snoozeExpiresAt: snoozeExpiresAt.toISOString()
      }, true);
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      showAlert('Failed to snooze reminder', 'error');
      await logReminderOperation('snooze', {
        jobNumber: job.jobNumber,
        error: error.message
      }, false);
    } finally {
      setLoading('snoozeReminder', false);
    }
  };

  const cancelSnooze = async (job: Job) => {
    try {
      setLoading('snoozeReminder', true);

      const { error } = await supabase
        .from('jobs')
        .update({
          snooze_expires_at: null,
          snoozed_until: null
          // Don't reset reminder_sent - let the reminder logic handle it
        })
        .eq('job_number', job.jobNumber);

      if (error) throw error;

      showAlert('Snooze cancelled', 'success');
      await loadJobs();

      await logReminderOperation('cancel_snooze', {
        jobNumber: job.jobNumber,
        clientName: job.clientName
      }, true);
    } catch (error) {
      console.error('Error cancelling snooze:', error);
      showAlert('Failed to cancel snooze', 'error');
      await logReminderOperation('cancel_snooze', {
        jobNumber: job.jobNumber,
        error: error.message
      }, false);
    } finally {
      setLoading('snoozeReminder', false);
    }
  };

  const markAsComplete = async (job: Job) => {
    const previousStatus = job.status;

    try {
      setLoading('markAsComplete', true);
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'Completed' })
        .eq('job_number', job.jobNumber);

      if (error) throw error;

      await loadJobs();

      // Undo function to revert the status change
      const undoComplete = async () => {
        try {
          const { error: undoError } = await supabase
            .from('jobs')
            .update({ status: previousStatus })
            .eq('job_number', job.jobNumber);

          if (undoError) throw undoError;

          await loadJobs();
          showAlert('Job status restored', 'success');
          await logJobOperation('undo complete', { jobNumber: job.jobNumber, restoredStatus: previousStatus }, true);
        } catch (undoError) {
          console.error('Error undoing completion:', undoError);
          showAlert('Failed to undo completion', 'error');
        }
      };

      showAlert(`Job ${job.jobNumber} marked as complete`, 'success', undoComplete, 'Undo');
      await logJobOperation('mark complete', { jobNumber: job.jobNumber, clientName: job.clientName }, true);
    } catch (error) {
      console.error('Error marking job complete:', error);
      showAlert('Failed to mark job as complete', 'error');
      await logJobOperation('mark complete', { jobNumber: job.jobNumber, error: error.message }, false);
    } finally {
      setLoading('markAsComplete', false);
    }
  };

  const exportData = async () => {
    try {
      setLoading('exportData', true);
      const { data, error } = await supabase.from('jobs').select('*');
      if (error) throw error;

      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-reminders-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      // Clean up the URL object to prevent memory leaks
      URL.revokeObjectURL(url);
      showAlert('Data exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      showAlert('Failed to export data', 'error');
    } finally {
      setLoading('exportData', false);
    }
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') return;
        const importedJobs = JSON.parse(result);

        // Validate imported data structure
        if (!Array.isArray(importedJobs)) {
          throw new Error('Invalid file format: Expected an array of jobs');
        }

        const dbJobs = importedJobs.map((job, index) => {
          if (!job.job_number && !job.jobNumber) {
            throw new Error(`Job at index ${index} is missing job number`);
          }
          if (!job.status) {
            throw new Error(`Job at index ${index} is missing status`);
          }
          
          return {
          job_number: job.job_number || job.jobNumber,
            client_name: job.client_name || job.clientName || 'Unknown Client',
            forwarding_date: job.forwarding_date || job.forwardingDate || new Date().toISOString().split('T')[0],
            production_deadline: job.production_deadline || job.productionDeadline || new Date().toISOString().split('T')[0],
          status: job.status,
          reminder_sent: job.reminder_sent || false,
          snoozed_until: job.snoozed_until || null,
          last_reminder_date: job.last_reminder_date || null
          };
        });

        const { error } = await supabase.from('jobs').insert(dbJobs);
        if (error) throw error;

        await loadJobs();
        showAlert(`Imported ${importedJobs.length} jobs successfully`, 'success');
      } catch (error) {
        console.error('Error importing data:', error);
        showAlert(error instanceof Error ? error.message : 'Failed to import data', 'error');
      } finally {
        // Clean up file input
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return <FaSort className="w-3 h-3 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ?
      <FaSortUp className="w-3 h-3" /> :
      <FaSortDown className="w-3 h-3" />;
  };

  const getStatusColor = (status: string): string => {
    const colors = {
      'In Production': 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
      'Completed': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      'Pending': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      'Delayed': 'bg-red-500/20 text-red-400 border border-red-500/30',
      'On Hold': 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
    };
    return colors[status] || 'bg-slate-600/20 text-slate-400 border border-slate-600/30';
  };

  // Format date as dd-mmm-yyyy (23-Oct-2025)
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getDaysUntilDeadline = useCallback((deadline: string, status: string): number | null => {
    if (status === 'Completed') {
      return null;
    }

    // Get current Pakistan time
    const pkTime = getPakistanTime();
    const today = new Date(pkTime.toDateString());
    today.setHours(0, 0, 0, 0);
    
    // Parse deadline date (assuming it's in YYYY-MM-DD format)
    const deadlineDate = new Date(deadline + 'T00:00:00+05:00'); // Pakistan timezone
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  const sortedAndFilteredJobs = () => {
    // First sort ALL jobs, then filter
    const sortedJobs = [...jobs].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Job];
      let bValue: any = b[sortConfig.key as keyof Job];

      // Handle different data types for sorting
      if (sortConfig.key === 'productionDeadline' || sortConfig.key === 'forwardingDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortConfig.key === 'daysLeft') {
        // For days left, we want critical jobs (overdue/urgent) at the top
        const aDays = getDaysUntilDeadline(a.productionDeadline, a.status);
        const bDays = getDaysUntilDeadline(b.productionDeadline, b.status);
        
        // Handle completed jobs (null days) - sort by job number descending (latest first)
        if (aDays === null && bDays === null) {
          // Both completed - sort by job number descending (highest numbers first)
          const extractNumber = (jobNum: string) => {
            const match = jobNum.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          
          const aNum = extractNumber(a.jobNumber);
          const bNum = extractNumber(b.jobNumber);
          
          // Sort descending (higher numbers first)
          if (aNum !== bNum) {
            return bNum - aNum;
          } else {
            // If numbers are same, sort alphabetically descending
            return b.jobNumber.toLowerCase().localeCompare(a.jobNumber.toLowerCase());
          }
        }
        if (aDays === null) return 1;  // Completed jobs go to bottom
        if (bDays === null) return -1; // Completed jobs go to bottom
        
        // For active jobs, sort by urgency: overdue (negative) first, then by days remaining
        aValue = aDays;
        bValue = bDays;
      } else if (sortConfig.key === 'jobNumber') {
        // Extract numeric part from job numbers for proper numeric sorting
        const extractNumber = (jobNum: string) => {
          const match = jobNum.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        
        const aNum = extractNumber(aValue);
        const bNum = extractNumber(bValue);
        
        // If numbers are different, sort by number
        if (aNum !== bNum) {
          aValue = aNum;
          bValue = bNum;
        } else {
          // If numbers are same, sort alphabetically
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
      } else if (sortConfig.key === 'clientName' || sortConfig.key === 'status') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Primary sort
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      
      // Secondary sort: fallback to job number for consistent ordering
      const aJobNum = a.jobNumber.toLowerCase();
      const bJobNum = b.jobNumber.toLowerCase();
      if (aJobNum < bJobNum) return -1;
      if (aJobNum > bJobNum) return 1;
      return 0;
    });

    // Then filter the sorted jobs
    return sortedJobs.filter(job => {
      const matchesSearch = job.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || job.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  };

  const filteredJobs = sortedAndFilteredJobs();
  
  // Pagination logic
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortConfig]);

  // Check for job number query parameter and populate search bar
  useEffect(() => {
    if (!isLoading && jobs.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const jobNumber = urlParams.get('job');
      
      if (jobNumber && searchTerm === '') {
        // Set the search term to the job number from URL
        setSearchTerm(jobNumber);
        
        // Clear the query parameter from URL after using it
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [isLoading, jobs, searchTerm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 backdrop-blur-xl rounded-xl p-10 border border-slate-800 shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
              <FaLock className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-center text-slate-100 mb-2">Loading...</h1>
          <div className="flex items-center justify-center mt-4">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    )
  }

  // Login Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
              <FaBell className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-slate-100 mb-2">Flycast Technologies</h1>
          <p className="text-center mb-8 text-slate-400 text-sm">Reminder Dashboard</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleSignIn}
              disabled={loadingStates.signIn}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {loadingStates.signIn && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {loadingStates.signIn ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Enterprise Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                <FaBell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-slate-100">Flycast Technologies</h1>
                <p className="text-xs sm:text-sm text-slate-400">Reminder Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip content={bulkSelectMode ? "Exit bulk select mode" : "Select multiple jobs for bulk actions"} id="bulk-select-btn" position="bottom">
                <button
                  onClick={() => {
                    setBulkSelectMode(!bulkSelectMode);
                    if (bulkSelectMode) {
                      setSelectedJobs(new Set());
                    }
                  }}
                  className={`min-w-[44px] min-h-[44px] p-2 sm:px-4 sm:py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium border touch-manipulation ${
                    bulkSelectMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <FaCheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">{bulkSelectMode ? 'Exit Bulk' : 'Bulk Select'}</span>
                </button>
              </Tooltip>

              <Tooltip content="Configure email settings for reminders" id="settings-btn" position="bottom">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="min-w-[44px] min-h-[44px] p-2 sm:px-4 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium border border-slate-700 touch-manipulation"
              >
                  <FaCog className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              </Tooltip>

              <Tooltip content="Sign out of your account" id="signout-btn" position="bottom">
              <button
                onClick={handleSignOut}
                className="min-w-[44px] min-h-[44px] p-2 sm:px-4 sm:py-2 rounded-lg bg-red-900/50 hover:bg-red-900/70 text-red-300 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium border border-red-800 touch-manipulation"
              >
                  <FaLock className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Quick Actions Panel */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-100 mb-1 sm:mb-2">Quick Actions</h2>
                <p className="text-slate-400 text-xs sm:text-sm">Manage jobs and configure system settings</p>
              </div>
            </div>


            {/* Job Data Input - Always Visible */}
            <div className="bg-slate-800/50 rounded-lg p-4 sm:p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-100">Add New Jobs</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">Paste tab-separated data from Excel or CSV</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                  <FaCalendarAlt className="w-3 h-3" />
                  <span>Ready to paste</span>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  onPaste={handlePaste}
                  disabled={loadingStates.pasteJobs}
                  placeholder="Paste tab-separated job data here...

Format: Job Number	Client Name	Forwarding Date	Production Deadline	Status
Example: SP-192	Stefan Nestorovic	15-Oct-2025	24-Oct-2025	In Production

Supported date formats: DD-MMM-YYYY, DD/MM/YYYY, or YYYY-MM-DD"
                  className="w-full h-32 sm:h-40 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none font-mono text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {loadingStates.pasteJobs && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-slate-300 font-medium">Processing data...</p>
                    </div>
                  </div>
                )}
                <div className="hidden sm:flex absolute top-3 right-3 items-center gap-2 text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
                  <FaPlus className="w-3 h-3" />
                  <span>Ctrl+V to paste</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
          <div className="bg-slate-900 rounded-xl p-3 sm:p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Total Jobs</p>
                <p className="text-2xl sm:text-4xl font-bold text-slate-100">{jobs.length}</p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                <FaCalendarAlt className="w-5 h-5 sm:w-7 sm:h-7 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-3 sm:p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">In Production</p>
                <p className="text-2xl sm:text-4xl font-bold text-cyan-400">
                  {jobs.filter(j => j.status === 'In Production').length}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-cyan-600/20 flex items-center justify-center border border-cyan-500/30">
                <FaPlay className="w-5 h-5 sm:w-7 sm:h-7 text-cyan-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-3 sm:p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Due Today</p>
                <p className="text-2xl sm:text-4xl font-bold text-orange-400">
                  {jobs.filter(j => j.status !== 'Completed' && getDaysUntilDeadline(j.productionDeadline, j.status) === 0).length}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/30">
                <FaClock className="w-5 h-5 sm:w-7 sm:h-7 text-orange-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-3 sm:p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Completed</p>
                <p className="text-2xl sm:text-4xl font-bold text-emerald-400">
                  {jobs.filter(j => j.status === 'Completed').length}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                <FaCheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 sm:p-6 mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by job number or client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all duration-200"
                    title="Clear search"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <FaFilter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-11 pr-10 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer appearance-none"
              >
                <option value="all">All Status</option>
                <option value="In Production">In Production</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Delayed">Delayed</option>
                <option value="On Hold">On Hold</option>
              </select>
              <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <Tooltip content="Refresh job data" id="refresh-btn" position="bottom">
              <button
                onClick={loadJobs}
                className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-slate-700"
              >
                <FaRedo className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </Tooltip>
          </div>
        </div>

              <style>{`
                @media (max-width: 768px) {
                  .mobile-table { display: block; }
                  .mobile-table thead { display: none; }
                  .mobile-table tbody { display: block; }
                  .mobile-table tr { display: block; margin-bottom: 16px; padding: 16px; background: #1e293b; border-radius: 8px; }
                  .mobile-table td { display: block; width: 100%; padding: 8px 0; border-bottom: 1px solid #374151; }
                  .mobile-table td:last-child { border-bottom: none; }
                  .mobile-table-label { font-weight: 600; color: #9ca3af; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
                  .mobile-table-value { color: #f1f5f9; font-size: 14px; }
                  .mobile-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
                }
              `}</style>

        {/* Mobile Cards View - Shown on screens < 768px */}
        <div className="mobile-cards md:hidden space-y-3 mb-8">
          {isLoading ? (
            // Mobile skeleton loader
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-32 mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-48 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-700 rounded w-full"></div>
                  <div className="h-3 bg-slate-700 rounded w-3/4"></div>
                </div>
              </div>
            ))
          ) : paginatedJobs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FaCalendarAlt className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-lg">No jobs found</p>
              <p className="text-sm">Add your first job to get started</p>
            </div>
          ) : (
            paginatedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onSendReminder={(job) => sendEmailReminder([job])}
                onSnooze={snoozeReminder}
                onCancelSnooze={cancelSnooze}
                onComplete={markAsComplete}
                onDelete={deleteJob}
                loading={loadingStates}
                calculateDaysRemaining={(deadline) => getDaysUntilDeadline(deadline, job.status) || 0}
                formatDate={formatDate}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedJobs.has(job.jobNumber)}
                onToggleSelection={toggleJobSelection}
              />
            ))
          )}

          {/* Mobile Pagination */}
          {filteredJobs.length > itemsPerPage && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 mt-4 shadow-xl">
              <div className="flex flex-col items-center gap-3 px-4 py-4">
                <span className="text-xs text-slate-400">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 touch-manipulation"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 touch-manipulation"
                  >
                    Prev
                  </button>
                  <span className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 touch-manipulation"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 touch-manipulation"
                  >
                    »»
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Toolbar */}
        {bulkSelectMode && selectedJobs.size > 0 && (
          <div className="mb-4 bg-blue-950/30 border border-blue-800 rounded-xl p-4 shadow-xl animate-slide-down">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <FaCheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {selectedJobs.size} job{selectedJobs.size !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-slate-400">Choose an action to apply to selected jobs</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={bulkSendReminders}
                  disabled={loadingStates.bulkRemind}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingStates.bulkRemind ? (
                    <FaClock className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaBell className="w-4 h-4" />
                  )}
                  Send Reminders
                </button>

                <button
                  onClick={bulkMarkAsComplete}
                  disabled={loadingStates.bulkComplete}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingStates.bulkComplete ? (
                    <FaClock className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaCheckCircle className="w-4 h-4" />
                  )}
                  Mark Complete
                </button>

                <button
                  onClick={bulkDeleteJobs}
                  disabled={loadingStates.bulkDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingStates.bulkDelete ? (
                    <FaClock className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaTrash className="w-4 h-4" />
                  )}
                  Delete
                </button>

                <button
                  onClick={() => {
                    setSelectedJobs(new Set());
                    setBulkSelectMode(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <FaTimes className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Table - Shown on screens >= 768px */}
        <div className="desktop-table hidden md:block bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700">
                <tr>
                  {bulkSelectMode && (
                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                    </th>
                  )}
                  <th
                    onClick={() => handleSort('jobNumber')}
                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      Job Number
                      {getSortIcon('jobNumber')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('clientName')}
                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <FaUser className="w-4 h-4" />
                      Client Name
                      {getSortIcon('clientName')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('forwardingDate')}
                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <FaCalendar className="w-4 h-4" />
                      Forwarding
                      {getSortIcon('forwardingDate')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('productionDeadline')}
                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <FaClock className="w-4 h-4" />
                      Deadline
                      {getSortIcon('productionDeadline')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('daysLeft')}
                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      Days Left
                      {getSortIcon('daysLeft')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-slate-700/50 transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  // Skeleton Loader
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="px-6 py-4">
                        <div className="h-4 rounded animate-pulse bg-slate-800 w-20"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 rounded animate-pulse bg-slate-800 w-32"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 rounded animate-pulse bg-slate-800 w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 rounded animate-pulse bg-slate-800 w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 rounded-full animate-pulse bg-slate-800 w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 rounded-full animate-pulse bg-slate-800 w-20"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="h-8 w-8 rounded-lg animate-pulse bg-slate-800"></div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-slate-800/50 flex items-center justify-center border border-slate-700">
                          <FaExclamationCircle className="w-10 h-10 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-slate-200 mb-2">No jobs found</p>
                          <p className="text-slate-400 text-sm">Add jobs using the quick actions panel or adjust your filters</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedJobs.map((job, index) => {
                    const daysLeft = getDaysUntilDeadline(job.productionDeadline, job.status);
                    const isCritical = daysLeft !== null && daysLeft <= 0;
                    return (
                      <tr
                        key={job.jobNumber}
                        id={`job-${job.id}`}
                        className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${isCritical ? 'animate-pulse-red' : ''}`}
                      >
                        {bulkSelectMode && (
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedJobs.has(job.jobNumber)}
                              onChange={() => toggleJobSelection(job.jobNumber)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="mobile-table-label md:hidden">Job Number</div>
                          <span className="font-semibold text-blue-400">{job.jobNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-200">
                          <div className="mobile-table-label md:hidden">Client Name</div>
                          <span className="mobile-table-value">{job.clientName}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-sm">
                          <div className="mobile-table-label md:hidden">Forwarding Date</div>
                          <span className="mobile-table-value">{formatDate(job.forwardingDate)}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-sm">
                          <div className="mobile-table-label md:hidden">Production Deadline</div>
                          <span className="mobile-table-value">{formatDate(job.productionDeadline)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="mobile-table-label md:hidden">Days Left</div>
                          {daysLeft !== null ? (
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                              daysLeft < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              daysLeft === 0 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                              daysLeft <= 3 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              <FaClock className="w-3 h-3" />
                              {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="mobile-table-label md:hidden">Status</div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="mobile-table-label md:hidden">Actions</div>
                          <div className="flex gap-2 mobile-actions md:flex-row">
                            {job.status !== 'Completed' ? (
                              <Tooltip content="Mark this job as completed" id={`complete-${job.jobNumber}`}>
                                <button
                                  onClick={() => markAsComplete(job)}
                                  className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all duration-200"
                                >
                                  <FaCheckCircle className="w-4 h-4" />
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip content="Job is already completed - only deletion allowed" id={`completed-${job.jobNumber}`}>
                                <button
                                  disabled
                                  className="p-2 rounded-lg bg-slate-500/20 text-slate-500 border border-slate-500/30 cursor-not-allowed opacity-50"
                                >
                                  <FaCheckCircle className="w-4 h-4" />
                                </button>
                              </Tooltip>
                            )}
                            
                            <div className="snooze-menu-container">
                              <Tooltip 
                                content={job.status === 'Completed' ? "Cannot snooze completed jobs" : job.snoozedUntil ? `Snoozed until ${new Date(job.snoozedUntil).toLocaleDateString()}` : "Set reminder"} 
                                id={`snooze-${job.jobNumber}`}
                              >
                              <button
                                id={`snooze-btn-${job.jobNumber}`}
                                onClick={(e) => {
                                  if (job.status !== 'Completed') {
                                    setShowSnoozeMenu(showSnoozeMenu === job.jobNumber ? null : job.jobNumber);
                                  }
                                }}
                                disabled={job.status === 'Completed'}
                                className={`p-2 rounded-lg border transition-all duration-200 ${
                                  job.status === 'Completed'
                                    ? 'bg-gray-500/20 text-gray-400 border-gray-500/30 cursor-not-allowed opacity-50'
                                    : job.snoozedUntil 
                                      ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/50' 
                                      : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30'
                                }`}
                              >
                                <FaBell className={`w-4 h-4 ${job.snoozedUntil && job.status !== 'Completed' ? 'animate-pulse' : ''}`} />
                              </button>
                              </Tooltip>
                              
                              {showSnoozeMenu === job.jobNumber && job.status !== 'Completed' && (
                                <div 
                                  className="fixed py-2 w-64 rounded-xl bg-slate-800 shadow-2xl border border-slate-700 z-[150] animate-slide-down"
                                  style={{
                                    top: (() => {
                                      const button = document.getElementById(`snooze-btn-${job.jobNumber}`);
                                      if (button) {
                                        const rect = button.getBoundingClientRect();
                                        const menuHeight = 280; // Approximate menu height
                                        const spaceBelow = window.innerHeight - rect.bottom;
                                        const spaceAbove = rect.top;
                                        
                                        // If not enough space below, show above
                                        if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
                                          return `${rect.top - menuHeight - 8}px`;
                                        }
                                        // Otherwise show below
                                        return `${rect.bottom + 8}px`;
                                      }
                                      return '0px';
                                    })(),
                                    right: (() => {
                                      const button = document.getElementById(`snooze-btn-${job.jobNumber}`);
                                      if (button) {
                                        const rect = button.getBoundingClientRect();
                                        return `${window.innerWidth - rect.right}px`;
                                      }
                                      return '0px';
                                    })()
                                  }}
                                >
                                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FaBell className="w-4 h-4 text-blue-400" />
                                      <p className="text-sm font-semibold text-slate-100">Set Reminder</p>
                                    </div>
                                    <button
                                      onClick={() => setShowSnoozeMenu(null)}
                                      className="text-slate-400 hover:text-slate-200 transition-colors p-1 hover:bg-slate-700 rounded"
                                    >
                                      <FaTimes className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="py-2">
                                    {[
                                      { hours: 1, label: '1 Hour', color: 'bg-cyan-500', icon: FaClock, badge: '1h' },
                                      { hours: 4, label: '4 Hours', color: 'bg-emerald-500', icon: FaClock, badge: '4h' },
                                      { hours: 24, label: '24 Hours', color: 'bg-blue-500', icon: FaClock, badge: '1d' },
                                      { hours: 48, label: '48 Hours', color: 'bg-yellow-500', icon: FaCalendar, badge: '2d' },
                                      { hours: 168, label: '1 Week', color: 'bg-purple-500', icon: FaCalendar, badge: '7d' }
                                    ].map(({ hours, label, color, icon: Icon, badge }) => (
                                      <button
                                        key={hours}
                                        onClick={() => snoozeReminder(job, hours)}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-slate-700/70 transition-all flex items-center gap-3 group"
                                      >
                                        <div className={`w-2.5 h-2.5 rounded-full ${color} group-hover:scale-125 transition-transform shadow-lg`}></div>
                                        <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300" />
                                        <span className="text-slate-200 font-medium flex-1">{label}</span>
                                        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">{badge}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <Tooltip content="Delete this job permanently" id={`delete-${job.jobNumber}`}>
                            <button
                              onClick={() => deleteJob(job.jobNumber)}
                                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all duration-200"
                            >
                                <FaTrash className="w-4 h-4" />
                            </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desktop Pagination - Hidden on mobile */}
        {filteredJobs.length > itemsPerPage && (
          <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 mt-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-400">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              {/* First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                title="First page"
              >
                ««
              </button>
              
              {/* Previous Page */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              {/* Next Page */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
              </button>
              
              {/* Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                title="Last page"
              >
                »»
              </button>
              </div>
              
              {/* Jump to Page - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-2 mt-4 sm:mt-0 sm:ml-4 sm:pl-4 sm:border-l sm:border-slate-700">
                <span className="text-sm text-slate-400">Go to:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                  className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-slate-400">of {totalPages}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification - Highest Z-Index */}
      {notification.show && (
        <div
          className="fixed top-20 right-6 min-w-[320px] max-w-md px-5 py-4 rounded-xl shadow-2xl font-medium z-[9999] transform transition-all duration-300 ease-in-out animate-slide-in-right border-l-4"
          style={{
            backgroundColor: notification.type === 'success' ? '#064e3b' :
              notification.type === 'error' ? '#7f1d1d' : '#78350f',
            color: notification.type === 'success' ? '#d1fae5' :
              notification.type === 'error' ? '#fecaca' : '#fef3c7',
            borderLeftColor: notification.type === 'success' ? '#10b981' :
              notification.type === 'error' ? '#ef4444' : '#f59e0b',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: notification.type === 'success' ? '#065f46' :
                  notification.type === 'error' ? '#991b1b' : '#92400e'
              }}
            >
              {notification.type === 'success' ? <FaCheckCircle className="w-5 h-5" /> :
                notification.type === 'error' ? <FaExclamationCircle className="w-5 h-5" /> :
                  <FaBell className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5">
                {notification.type === 'success' ? 'Success' :
                  notification.type === 'error' ? 'Error' : 'Notice'}
              </p>
              <p className="text-sm opacity-90 break-words">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
              className="flex-shrink-0 ml-2 hover:opacity-75 transition-opacity p-2 rounded-lg hover:bg-white/10"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
          {notification.undoAction && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <button
                onClick={() => {
                  notification.undoAction?.();
                  setNotification(prev => ({ ...prev, show: false }));
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-semibold"
              >
                {notification.undoLabel || 'Undo'}
              </button>
            </div>
          )}
          {/* Progress bar */}
          <div
            className="absolute bottom-0 left-0 h-1 rounded-bl-xl animate-progress-bar"
            style={{
              width: '100%',
              backgroundColor: notification.type === 'success' ? '#10b981' :
                notification.type === 'error' ? '#ef4444' : '#f59e0b',
              opacity: 0.6
            }}
          />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowSettings(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"></div>
          
          {/* Modal */}
          <div 
            className="relative bg-slate-900 rounded-xl border border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-down"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                  <FaCog className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">Email Configuration</h3>
                  <p className="text-sm text-slate-400 mt-0.5">Configure email reminders (9:00 AM PKT daily)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-slate-100 transition-all duration-200 border border-slate-700"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {isEmailConfigLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-300">Loading email configuration...</span>
                  </div>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="flex items-center gap-2">
                      <FaUser className="w-3.5 h-3.5" />
                      To (Recipient Email)
                    </span>
                  </label>
                  <input
                    type="email"
                    placeholder="recipient@example.com"
                    value={emailConfig.toEmail}
                    onChange={(e) => {
                      setEmailConfig({ ...emailConfig, toEmail: e.target.value });
                      if (emailConfigErrors.toEmail) {
                        setEmailConfigErrors(prev => ({ ...prev, toEmail: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                      emailConfigErrors.toEmail 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                  {emailConfigErrors.toEmail ? (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                      <span>⚠</span>
                      {emailConfigErrors.toEmail}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-2">Email address that will receive reminder notifications</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="flex items-center gap-2">
                      <FaBell className="w-3.5 h-3.5" />
                      From (Sender Gmail Address)
                    </span>
                  </label>
                  <input
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={emailConfig.fromEmail}
                    onChange={(e) => {
                      setEmailConfig({ ...emailConfig, fromEmail: e.target.value });
                      if (emailConfigErrors.fromEmail) {
                        setEmailConfigErrors(prev => ({ ...prev, fromEmail: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                      emailConfigErrors.fromEmail 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                  {emailConfigErrors.fromEmail ? (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                      <span>⚠</span>
                      {emailConfigErrors.fromEmail}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-2">Gmail address used to send notifications</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="flex items-center gap-2">
                      <FaLock className="w-3.5 h-3.5" />
                      From Password (Gmail App Password)
                    </span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Gmail app password"
                    value={emailConfig.fromPassword}
                    onChange={(e) => {
                      setEmailConfig({ ...emailConfig, fromPassword: e.target.value });
                      if (emailConfigErrors.fromPassword) {
                        setEmailConfigErrors(prev => ({ ...prev, fromPassword: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-lg bg-slate-800 border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                      emailConfigErrors.fromPassword 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                  {emailConfigErrors.fromPassword ? (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                      <span>⚠</span>
                      {emailConfigErrors.fromPassword}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-2">Gmail app password for authentication</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    <a 
                      href="https://support.google.com/accounts/answer/185833" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                    >
                      How to generate Gmail app password
                      <span className="text-xs">↗</span>
                    </a>
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mb-6">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="emailEnabled"
                    checked={emailConfig.configured}
                    onChange={(e) => setEmailConfig({ ...emailConfig, configured: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                  />
                  <label htmlFor="emailEnabled" className="flex-1 cursor-pointer">
                    <p className="text-sm font-medium text-slate-200">Enable automated email reminders</p>
                    <p className="text-xs text-slate-400 mt-1">Reminders will be sent at 9:00 AM PKT daily for jobs due today</p>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveEmailConfig}
                    disabled={isEmailConfigSaving}
                    className="flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    {isEmailConfigSaving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaCheckCircle className="w-4 h-4" />
                    )}
                    {isEmailConfigSaving ? 'Saving...' : 'Save Configuration'}
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all duration-200 border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
                <button
                  onClick={sendTestEmail}
                  className="w-full px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-all duration-200 border border-slate-700 flex items-center justify-center gap-2"
                >
                  <FaBell className="w-4 h-4" />
                  Send Test Email
                </button>
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paste Preview Modal */}
      {pastePreview.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-4xl w-full my-8 animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-700 bg-blue-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-600">
                    <FaCalendarAlt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">Review Pasted Jobs</h3>
                    <p className="text-sm text-slate-400">
                      {pastePreview.unique.length} unique • {pastePreview.duplicates.length} duplicate{pastePreview.duplicates.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPastePreview({ show: false, jobs: [], duplicates: [], unique: [] })}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {pastePreview.duplicates.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FaExclamationCircle className="w-4 h-4 text-yellow-500" />
                    <h4 className="text-sm font-semibold text-yellow-500">
                      Duplicate Jobs (Will be skipped)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {pastePreview.duplicates.map((job, index) => (
                      <div key={index} className="bg-yellow-950/20 border border-yellow-900/50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-yellow-500">{job.jobNumber}</p>
                            <p className="text-sm text-slate-400">{job.clientName}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Deadline: {formatDate(job.productionDeadline)}
                            </p>
                          </div>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300">
                            Already exists
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pastePreview.unique.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FaCheckCircle className="w-4 h-4 text-green-500" />
                    <h4 className="text-sm font-semibold text-green-500">
                      New Jobs (Will be added)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {pastePreview.unique.map((job, index) => (
                      <div key={index} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-100">{job.jobNumber}</p>
                            <p className="text-sm text-slate-400">{job.clientName}</p>
                            <div className="flex gap-4 mt-2 text-xs text-slate-500">
                              <span>Forwarding: {formatDate(job.forwardingDate)}</span>
                              <span>Deadline: {formatDate(job.productionDeadline)}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            job.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            job.status === 'In Production' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            job.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            job.status === 'Delayed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pastePreview.unique.length === 0 && pastePreview.duplicates.length > 0 && (
                <div className="text-center py-8">
                  <FaExclamationCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-slate-300 font-medium">All jobs are duplicates</p>
                  <p className="text-sm text-slate-500 mt-1">No new jobs to add</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-800/50 rounded-b-xl flex gap-3 justify-end border-t border-slate-700">
              <button
                onClick={() => setPastePreview({ show: false, jobs: [], duplicates: [], unique: [] })}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-all duration-200 border border-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmPasteJobs}
                disabled={pastePreview.unique.length === 0 || loadingStates.pasteJobs}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loadingStates.pasteJobs ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <FaPlus className="w-4 h-4" />
                    <span>Add {pastePreview.unique.length} Job{pastePreview.unique.length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full animate-scale-in">
            <div className={`px-6 py-4 border-b border-slate-700 flex items-center gap-3 ${
              confirmDialog.variant === 'danger' ? 'bg-red-950/30' : 'bg-yellow-950/30'
            }`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                confirmDialog.variant === 'danger' ? 'bg-red-600' : 'bg-yellow-600'
              }`}>
                <FaExclamationCircle className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">{confirmDialog.title}</h3>
            </div>

            <div className="px-6 py-6">
              <p className="text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            </div>

            <div className="px-6 py-4 bg-slate-800/50 rounded-b-xl flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-all duration-200 border border-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobReminderSystem;
