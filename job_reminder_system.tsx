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
  FaDownload, 
  FaUpload, 
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
  FaPause
} from 'react-icons/fa';
import { supabase } from './src/supabaseClient';

interface Job {
  id: number;
  jobNumber: string;
  clientName: string;
  forwardingDate: string;
  productionDeadline: string;
  status: string;
  reminderSent: boolean;
  snoozedUntil: string | null;
  lastReminderDate: string | null;
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
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [showQuickActions, setShowQuickActions] = useState(false);

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

  useEffect(() => {
    if (session) {
      loadJobs();
      loadEmailConfig();
      checkReminders();
      const interval = setInterval(checkReminders, 300000); // Check every 5 minutes
      return () => clearInterval(interval);
    }
  }, [session]);

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showAlert('Login successful', 'success');
    } catch (error) {
      showAlert(error.error_description || error.message, 'error');
    }
  };

  const handleSignUp = async () => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showAlert('Check your email for the confirmation link!', 'success');
    } catch (error) {
      showAlert(error.error_description || error.message, 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showAlert('Logged out successfully', 'success');
    } catch (error) {
      showAlert(error.error_description || error.message, 'error');
    }
  };

  const loadJobs = async () => {
    setIsLoading(true);
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
        lastReminderDate: job.last_reminder_date,
        createdAt: job.created_at
      }));

      setJobs(formattedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      showAlert('Failed to load jobs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmailConfig = () => {
    try {
      const result = localStorage.getItem('email-config');
      if (result) {
        setEmailConfig(JSON.parse(result));
      }
    } catch (error) {
    }
  };

  const saveEmailConfig = () => {
    try {
      if (!emailConfig.toEmail || !emailConfig.fromEmail || !emailConfig.fromPassword) {
        showAlert('Please fill in all email configuration fields', 'warning');
        return;
      }
      localStorage.setItem('email-config', JSON.stringify(emailConfig));
      showAlert('Email configuration saved successfully', 'success');
    } catch (error) {
      showAlert('Failed to save email configuration', 'error');
    }
  };

  const sendTestEmail = async () => {
    if (!emailConfig.toEmail || !emailConfig.fromEmail || !emailConfig.fromPassword) {
      showAlert('Please fill in all email configuration fields first', 'warning');
      return;
    }

    showAlert('Sending test email...', 'success');

    try {
      // Create a test job
      const testJob = {
        jobNumber: 'TEST-001',
        clientName: 'Test Client',
        forwardingDate: new Date().toISOString().split('T')[0],
        productionDeadline: new Date().toISOString().split('T')[0],
        status: 'In Production'
      };


      const response = await fetch('/.netlify/functions/send-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job: testJob,
          emailConfig
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send test email`);
      }

      await response.json();

      showAlert('Test email sent successfully! Check your inbox.', 'success');
    } catch (error) {
      showAlert(`Failed to send test email: ${error.message}`, 'error');
    }
  };

  const checkReminders = async () => {
    const pkTime = getPakistanTime();
    const hour = pkTime.getHours();
    const minute = pkTime.getMinutes();

    // Check at 9:00 AM PKT (with some tolerance for timing issues)
    if (hour === 9 && minute >= 0 && minute <= 4) {
      const today = new Date(pkTime.toDateString());
      today.setHours(0, 0, 0, 0);

      for (const job of jobs) {
        if (job.status === 'Completed') continue;

        // Parse deadline using Pakistan timezone
        const deadlineDate = new Date(job.productionDeadline + 'T00:00:00+05:00');
        deadlineDate.setHours(0, 0, 0, 0);
        
        const snoozedUntil = job.snoozedUntil ? new Date(job.snoozedUntil + 'T00:00:00+05:00') : null;
        if (snoozedUntil) {
          snoozedUntil.setHours(0, 0, 0, 0);
        }

        const shouldRemindFromSnooze = snoozedUntil && snoozedUntil.toDateString() === today.toDateString();
        const isDeadlineToday = deadlineDate.toDateString() === today.toDateString() && !job.reminderSent;

        if (shouldRemindFromSnooze || isDeadlineToday) {
          await sendEmailReminder(job);
        }
      }
    }
  };

  const sendEmailReminder = async (job: Job) => {
    if (!emailConfig.configured) {
      return;
    }

    try {
      // Send email via Netlify Function
      const response = await fetch('/.netlify/functions/send-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job,
          emailConfig
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email reminder');
      }

      // Update database to mark reminder as sent
      await supabase
        .from('jobs')
        .update({
          reminder_sent: true,
          last_reminder_date: new Date().toISOString(),
          snoozed_until: null
        })
        .eq('job_number', job.jobNumber);

      await loadJobs();
      
    } catch (error) {
      console.error('Error sending email reminder:', error);
      showAlert('Failed to send email reminder', 'error');
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
        lastReminderDate: null,
        createdAt: new Date().toISOString()
      });
    }

    return jobsData;
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    try {
      const parsedJobs = parseJobData(pastedText);

      const dbJobs = parsedJobs.map(job => ({
        job_number: job.jobNumber,
        client_name: job.clientName,
        forwarding_date: job.forwardingDate,
        production_deadline: job.productionDeadline,
        status: job.status,
        reminder_sent: false,
        snoozed_until: null,
        last_reminder_date: null
      }));

      // Check for duplicate job numbers before inserting
      const existingJobNumbers = jobs.map(job => job.jobNumber);
      const duplicateJobs = parsedJobs.filter(job => existingJobNumbers.includes(job.jobNumber));
      
      if (duplicateJobs.length > 0) {
        throw new Error(`Duplicate job numbers found: ${duplicateJobs.map(j => j.jobNumber).join(', ')}. Please remove duplicates before adding.`);
      }

      const { error } = await supabase.from('jobs').insert(dbJobs);
      if (error) throw error;

      await loadJobs();
      setInputText('');
      showAlert(`Successfully added ${parsedJobs.length} job(s)`, 'success');
    } catch (error) {
      console.error('Error adding jobs:', error);
      showAlert(error.message, 'error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const deleteJob = async (jobNumber: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('job_number', jobNumber);

      if (error) throw error;

      await loadJobs();
      showAlert('Job deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting job:', error);
      showAlert('Failed to delete job', 'error');
    }
  };

  const snoozeReminder = async (job: Job, days: number) => {
    const pkTime = getPakistanTime();
    const snoozeDate = new Date(pkTime);
    snoozeDate.setDate(snoozeDate.getDate() + days);
    snoozeDate.setHours(0, 0, 0, 0);

    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          snoozed_until: snoozeDate.toISOString(),
          reminder_sent: false
        })
        .eq('job_number', job.jobNumber);

      if (error) throw error;

      const dayText = days === 1 ? 'tomorrow' : days === 2 ? 'in 2 days' : `in ${days} days`;
      showAlert(`Will remind you ${dayText} at 9 AM PKT`, 'success');
      setShowSnoozeMenu(null);
      await loadJobs();
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      showAlert('Failed to snooze reminder', 'error');
    }
  };

  const markAsComplete = async (job: Job) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'Completed' })
        .eq('job_number', job.jobNumber);

      if (error) throw error;

      showAlert('Job marked as complete', 'success');
      await loadJobs();
    } catch (error) {
      console.error('Error marking job complete:', error);
      showAlert('Failed to mark job as complete', 'error');
    }
  };

  const exportData = async () => {
    try {
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
    let filtered = jobs.filter(job => {
      const matchesSearch = job.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || job.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'productionDeadline' || sortConfig.key === 'forwardingDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortConfig.key === 'daysLeft') {
        aValue = getDaysUntilDeadline(a.productionDeadline, a.status) ?? 999;
        bValue = getDaysUntilDeadline(b.productionDeadline, b.status) ?? 999;
      }

      // Primary sort
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      
      // Secondary sort: fallback to job number (descending - higher numbers first)
      // Extract numeric part from job numbers for proper numeric sorting
      const extractNumber = (jobNum: string) => {
        const match = jobNum.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      
      const aNum = extractNumber(a.jobNumber);
      const bNum = extractNumber(b.jobNumber);
      
      // Sort descending (higher numbers first)
      if (aNum > bNum) return -1;
      if (aNum < bNum) return 1;
      
      // If numbers are equal, sort by full job number alphabetically
      const aJobNum = a.jobNumber.toLowerCase();
      const bJobNum = b.jobNumber.toLowerCase();
      if (aJobNum < bJobNum) return 1;
      if (aJobNum > bJobNum) return -1;
      return 0;
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

  // Scroll to job if URL has hash (for email links)
  useEffect(() => {
    if (!isLoading && jobs.length > 0) {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#job-')) {
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a highlight effect
            element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
            }, 3000);
          }
        }, 500); // Wait for rendering
      }
    }
  }, [isLoading, jobs]);

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
          <h1 className="text-3xl font-bold text-center text-slate-100 mb-2">Flycast Marketing</h1>
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
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Sign In
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
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                <FaBell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Flycast Marketing</h1>
                <p className="text-sm text-slate-400">Reminder Dashboard</p>
            </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip content="Export all job data as JSON file" id="export-btn" position="bottom">
              <button
                onClick={exportData}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-slate-700"
              >
                  <FaDownload className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              </Tooltip>
              
              <Tooltip content="Import job data from JSON file" id="import-btn" position="bottom">
                <label className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium cursor-pointer border border-slate-700">
                  <FaUpload className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
                <input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
              </Tooltip>
              
              <Tooltip content="Configure email settings for reminders" id="settings-btn" position="bottom">
              <button
                onClick={() => setShowSettings(!showSettings)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-slate-700"
              >
                  <FaCog className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              </Tooltip>
              
              <Tooltip content="Sign out of your account" id="signout-btn" position="bottom">
              <button
                onClick={handleSignOut}
                  className="px-4 py-2 rounded-lg bg-red-900/50 hover:bg-red-900/70 text-red-300 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-red-800"
              >
                  <FaLock className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Quick Actions Panel */}
        <div className="mb-8">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-100 mb-2">Quick Actions</h2>
                <p className="text-slate-400 text-sm">Manage jobs and configure system settings</p>
              </div>
            </div>


            {/* Job Data Input - Always Visible */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Add New Jobs</h3>
                  <p className="text-sm text-slate-400 mt-1">Paste tab-separated data from Excel or CSV</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                  <FaCalendarAlt className="w-3 h-3" />
                  <span>Ready to paste</span>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  onPaste={handlePaste}
                  placeholder="Paste tab-separated job data here...

Format: Job Number	Client Name	Forwarding Date	Production Deadline	Status
Example: SP-192	Stefan Nestorovic	15-Oct-2025	24-Oct-2025	In Production

Supported date formats: DD-MMM-YYYY, DD/MM/YYYY, or YYYY-MM-DD"
                  className="w-full h-40 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none font-mono text-sm"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
                  <FaPlus className="w-3 h-3" />
                  <span>Ctrl+V to paste</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-2">Total Jobs</p>
                <p className="text-4xl font-bold text-slate-100">{jobs.length}</p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                <FaCalendarAlt className="w-7 h-7 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-2">In Production</p>
                <p className="text-4xl font-bold text-cyan-400">
                  {jobs.filter(j => j.status === 'In Production').length}
                </p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-cyan-600/20 flex items-center justify-center border border-cyan-500/30">
                <FaPlay className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-2">Due Today</p>
                <p className="text-4xl font-bold text-orange-400">
                  {jobs.filter(j => j.status !== 'Completed' && getDaysUntilDeadline(j.productionDeadline, j.status) === 0).length}
                </p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/30">
                <FaClock className="w-7 h-7 text-orange-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-2">Completed</p>
                <p className="text-4xl font-bold text-emerald-400">
                  {jobs.filter(j => j.status === 'Completed').length}
                </p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                <FaCheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-8 shadow-xl">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by job number or client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
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
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700">
                <tr>
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
                        <td className="px-6 py-4">
                          <span className="font-semibold text-blue-400">{job.jobNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-200">{job.clientName}</td>
                        <td className="px-6 py-4 text-slate-300 text-sm">{formatDate(job.forwardingDate)}</td>
                        <td className="px-6 py-4 text-slate-300 text-sm">{formatDate(job.productionDeadline)}</td>
                        <td className="px-6 py-4">
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
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Tooltip content="Mark this job as completed" id={`complete-${job.jobNumber}`}>
                            <button
                              onClick={() => markAsComplete(job)}
                                className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all duration-200"
                            >
                                <FaCheckCircle className="w-4 h-4" />
                            </button>
                            </Tooltip>
                            
                            <div className="snooze-menu-container">
                              <Tooltip 
                                content={job.snoozedUntil ? `Snoozed until ${new Date(job.snoozedUntil).toLocaleDateString()}` : "Set reminder"} 
                                id={`snooze-${job.jobNumber}`}
                              >
                              <button
                                id={`snooze-btn-${job.jobNumber}`}
                                onClick={(e) => {
                                  setShowSnoozeMenu(showSnoozeMenu === job.jobNumber ? null : job.jobNumber);
                                }}
                                  className={`p-2 rounded-lg border transition-all duration-200 ${
                                    job.snoozedUntil 
                                      ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/50' 
                                      : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30'
                                  }`}
                                >
                                  <FaBell className={`w-4 h-4 ${job.snoozedUntil ? 'animate-pulse' : ''}`} />
                              </button>
                              </Tooltip>
                              
                              {showSnoozeMenu === job.jobNumber && (
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
                                      { days: 1, label: 'Tomorrow', color: 'bg-emerald-500', icon: FaClock },
                                      { days: 2, label: 'In 2 days', color: 'bg-blue-500', icon: FaClock },
                                      { days: 3, label: 'In 3 days', color: 'bg-yellow-500', icon: FaClock },
                                      { days: 7, label: 'In 1 week', color: 'bg-orange-500', icon: FaCalendar },
                                      { days: 14, label: 'In 2 weeks', color: 'bg-purple-500', icon: FaCalendar }
                                    ].map(({ days, label, color, icon: Icon }) => (
                                      <button
                                        key={days}
                                        onClick={() => snoozeReminder(job, days)}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-slate-700/70 transition-all flex items-center gap-3 group"
                                      >
                                        <div className={`w-2.5 h-2.5 rounded-full ${color} group-hover:scale-125 transition-transform shadow-lg`}></div>
                                        <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-300" />
                                        <span className="text-slate-200 font-medium flex-1">{label}</span>
                                        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">+{days}d</span>
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

        {/* Pagination */}
        {filteredJobs.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 rounded-xl border border-slate-800 mt-6 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
              </span>
              </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Previous
              </button>
              
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
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification - Better Positioning */}
      {notification.show && (
        <div 
          className="fixed top-20 right-6 min-w-[320px] max-w-md px-5 py-4 rounded-xl shadow-2xl font-medium flex items-center gap-3 z-[100] transform transition-all duration-300 ease-in-out animate-slide-in-right border-l-4"
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
                    onChange={(e) => setEmailConfig({ ...emailConfig, toEmail: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <p className="text-xs text-slate-500 mt-2">Email address that will receive reminder notifications</p>
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
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <p className="text-xs text-slate-500 mt-2">Gmail address used to send notifications</p>
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
                    onChange={(e) => setEmailConfig({ ...emailConfig, fromPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
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
                    className="flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    <FaCheckCircle className="w-4 h-4" />
                    Save Configuration
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobReminderSystem;
