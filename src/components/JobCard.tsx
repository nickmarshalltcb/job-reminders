import React, { useState } from 'react';
import { FaCheckCircle, FaClock, FaEnvelope, FaTrash, FaTimes, FaCalendar, FaChevronDown, FaChevronUp } from 'react-icons/fa';

interface Job {
  id: number;
  jobNumber: string;
  clientName: string;
  forwardingDate: string;
  productionDeadline: string;
  status: string;
  reminderSent: boolean;
  snoozedUntil: string | null;
  snoozeExpiresAt: string | null;
  lastReminderDate: string | null;
  lastReminderSentAt: string | null;
  createdAt: string;
}

interface JobCardProps {
  job: Job;
  onSendReminder: (job: Job) => void;
  onSnooze: (job: Job, hours: number) => void;
  onCancelSnooze?: (job: Job) => void;
  onComplete: (job: Job) => void;
  onDelete: (jobNumber: string) => void;
  loading: any;
  calculateDaysRemaining: (deadline: string) => number;
  formatDate: (dateString: string) => string;
  bulkSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (jobNumber: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onSendReminder,
  onSnooze,
  onCancelSnooze,
  onComplete,
  onDelete,
  loading,
  calculateDaysRemaining,
  formatDate,
  bulkSelectMode = false,
  isSelected = false,
  onToggleSelection
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const isCompleted = job.status === 'Completed';
  const daysRemaining = calculateDaysRemaining(job.productionDeadline);
  const isOverdue = !isCompleted && daysRemaining < 0;
  const isDueToday = !isCompleted && daysRemaining === 0;
  const isUrgent = !isCompleted && daysRemaining > 0 && daysRemaining <= 2;

  let urgencyColor = 'bg-green-500';
  let urgencyText = 'On Track';
  if (isCompleted) {
    urgencyColor = 'bg-slate-500';
    urgencyText = 'COMPLETED';
  } else if (isOverdue) {
    urgencyColor = 'bg-red-500';
    urgencyText = 'OVERDUE';
  } else if (isDueToday) {
    urgencyColor = 'bg-orange-500';
    urgencyText = 'DUE TODAY';
  } else if (isUrgent) {
    urgencyColor = 'bg-yellow-500';
    urgencyText = 'URGENT';
  }

  return (
    <div className={`bg-slate-800/50 border rounded-lg p-4 mb-3 hover:border-slate-600 transition-all ${
      isSelected ? 'border-blue-500 bg-blue-950/20' : 'border-slate-700'
    }`}>
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 flex items-start gap-3">
          {bulkSelectMode && onToggleSelection && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelection(job.jobNumber)}
              className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer touch-manipulation"
            />
          )}
          <div>
            <h3 className="text-lg font-semibold text-white">{job.jobNumber}</h3>
            <p className="text-sm text-slate-400">{job.clientName}</p>
          </div>
        </div>
        <div className={`${urgencyColor} text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap`}>
          {urgencyText}
        </div>
      </div>

      {/* Snooze Alert - Prominent indicator when job is snoozed */}
      {job.snoozeExpiresAt && (
        <div className="mb-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <FaClock className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400 uppercase">Snoozed</span>
            </div>
            {onCancelSnooze && (
              <button
                onClick={() => onCancelSnooze(job)}
                disabled={loading.snoozeReminder}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-50"
              >
                Cancel Snooze
              </button>
            )}
          </div>
          <div className="text-xs text-yellow-200">
            Reminder snoozed until <span className="font-semibold">{new Date(job.snoozeExpiresAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}</span>
          </div>
          <div className="text-xs text-yellow-300/70 mt-1">
            This job is currently snoozed. Reminder will be sent automatically when snooze expires.
          </div>
        </div>
      )}

      {/* Quick Info */}
      <div className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Deadline:</span>
          <span className="text-white font-medium">{formatDate(job.productionDeadline)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Days Remaining:</span>
          <span className={`font-medium ${isOverdue ? 'text-red-400' : isDueToday ? 'text-orange-400' : 'text-green-400'}`}>
            {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
          </span>
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <div className="mb-3 pt-3 border-t border-slate-700 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Forwarding Date:</span>
            <span className="text-white">{formatDate(job.forwardingDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="text-white">{job.status}</span>
          </div>
          {job.snoozeExpiresAt && (
            <div className="flex justify-between">
              <span className="text-slate-400">Snoozed Until:</span>
              <span className="text-yellow-400">{new Date(job.snoozeExpiresAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
      >
        {isExpanded ? (
          <>
            <FaChevronUp className="w-3 h-3" />
            Show Less
          </>
        ) : (
          <>
            <FaChevronDown className="w-3 h-3" />
            Show More
          </>
        )}
      </button>

      {/* Action Buttons */}
      <div className={`grid ${isCompleted ? 'grid-cols-1' : 'grid-cols-2'} gap-2 mt-3`}>
        {/* Send Reminder - Hide for completed jobs */}
        {!isCompleted && (
          <button
            onClick={() => onSendReminder(job)}
            disabled={loading.sendEmailReminder}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 touch-manipulation min-h-[44px]"
          >
            <FaEnvelope className="w-4 h-4" />
            <span className="text-sm">Remind</span>
          </button>
        )}

        {/* Complete - Hide for already completed jobs */}
        {!isCompleted && (
          <button
            onClick={() => onComplete(job)}
            disabled={loading.markAsComplete}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 touch-manipulation min-h-[44px]"
          >
            <FaCheckCircle className="w-4 h-4" />
            <span className="text-sm">Complete</span>
          </button>
        )}

        {/* Snooze - Hide for completed jobs */}
        {!isCompleted && (
          <div className="relative">
          <button
            onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
            disabled={!!job.snoozeExpiresAt}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all touch-manipulation min-h-[44px] ${
              job.snoozeExpiresAt
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
            title={job.snoozeExpiresAt ? 'Already snoozed - cancel snooze to set a new one' : 'Snooze this reminder'}
          >
            <FaClock className="w-4 h-4" />
            <span className="text-sm">{job.snoozeExpiresAt ? 'Snoozed' : 'Snooze'}</span>
          </button>

          {/* Snooze Menu */}
          {showSnoozeMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-300">Snooze for</span>
                <button
                  onClick={() => setShowSnoozeMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              </div>
              <div className="py-1">
                {[
                  { hours: 1, label: '1 Hour', color: 'bg-cyan-500' },
                  { hours: 4, label: '4 Hours', color: 'bg-emerald-500' },
                  { hours: 24, label: '24 Hours', color: 'bg-blue-500' },
                  { hours: 48, label: '48 Hours', color: 'bg-yellow-500' },
                  { hours: 168, label: '1 Week', color: 'bg-purple-500' }
                ].map(({ hours, label, color }) => (
                  <button
                    key={hours}
                    onClick={() => {
                      onSnooze(job, hours);
                      setShowSnoozeMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-slate-800 transition-all flex items-center gap-3 touch-manipulation"
                  >
                    <div className={`w-2 h-2 rounded-full ${color}`}></div>
                    <span className="text-slate-200 font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Delete - Always show */}
        <button
          onClick={() => onDelete(job.jobNumber)}
          disabled={loading.deleteJob}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 touch-manipulation min-h-[44px]"
        >
          <FaTrash className="w-4 h-4" />
          <span className="text-sm">Delete</span>
        </button>
      </div>
    </div>
  );
};
