// Shared Review button used by Test Result, Test History, and the Course
// Player top bar. Renders the same visual + interaction in all three
// places so the lock/unlock UX is uniform.
//
// When `locked` is true (test has a future reviewUnlockAt and the user
// isn't the creator):
//   • Button looks dimmed with a small lock badge on the icon.
//   • Clicking it opens a CENTERED MODAL (same chrome as the in-test
//     Exit Confirm modal) that explains when review opens — wording is
//     friendly and the modal carries a single "Got it" dismiss button.
//   • No navigation — the modal IS the answer.
//
// When `locked` is false, click fires `onClick` (caller handles the
// actual navigation).
import { useState } from 'react';
import { FiEye, FiLock, FiX } from 'react-icons/fi';
import { fmtPktDateTime, fmtCountdown } from '../../../shared/utils/pktDate';

const ReviewLockButton = ({
  locked,
  reviewUnlockAt,
  onClick,
  // Visual variant — caller indicates which surface it lives on so the
  // button picks up the right "ghost vs primary" treatment. Today
  // everything is ghost-styled; the prop is kept for future-proofing.
  variant = 'ghost',  // eslint-disable-line no-unused-vars
  label   = 'Review answers',
  iconOnlyBelow = 'lg',
  // Stretch the button to fill its parent container — used by the
  // mobile action row on TestResultPage so Review sits flush next to
  // Retake at 50% width each. Default false keeps top-bar usage compact.
  fullWidth = false,
}) => {
  const [open, setOpen] = useState(false);

  // Three visual flavors stacked on the same component:
  //   • inline (default)    → ghost, no border, used in top bars where the
  //     button sits next to other compact actions.
  //   • fullWidth (opt-in)  → outlined, w-full + centered, used in mobile
  //     action rows where it pairs with a btn-brand at 50/50 width.
  //   • variant='prominent' → larger outlined button used by the Course
  //     Player top bar so Review reads as a real action next to Retake,
  //     not a forgettable text link.
  const baseCls = variant === 'prominent'
    ? 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-strong)] hover:bg-[var(--bg-muted)] hover:border-primary-300 dark:hover:border-primary-800 transition-colors'
    : fullWidth
      ? 'w-full flex justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors'
      : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors';

  const labelHideCls = iconOnlyBelow === 'lg'
    ? 'hidden lg:inline'
    : iconOnlyBelow === 'sm'
      ? 'hidden sm:inline'
      : 'inline'; // 'none' / any other → always show the label

  if (!locked) {
    return (
      <button type="button" onClick={onClick} className={baseCls} title={label}>
        <FiEye className="w-4 h-4" />
        <span className={labelHideCls}>{label}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${baseCls} opacity-60`}
        title="Review is locked"
        aria-haspopup="dialog"
      >
        <span className="relative inline-flex">
          <FiEye className="w-4 h-4" />
          {/* Tiny lock badge on the eye icon — strong visual cue even
              before the modal opens. */}
          <FiLock className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-amber-500" />
        </span>
        <span className={labelHideCls}>{label}</span>
      </button>

      {/* Centered confirm-style modal — same backdrop + chrome as the
          existing ExitConfirmModal / SubmitConfirmModal in the test
          player so the lock notice feels like part of the same family. */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm p-5 text-center border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-[var(--text-faint)] hover:text-[var(--text-strong)]"
              aria-label="Close"
            >
              <FiX className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <FiLock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-display font-bold text-[var(--text-strong)] mb-1">
              Review isn't open yet
            </h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              You'll be able to review your answers{' '}
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {fmtCountdown(reviewUnlockAt) || 'shortly'}
              </span>
              .
            </p>
            <p className="text-xs text-[var(--text-faint)] mt-2">
              Opens {fmtPktDateTime(reviewUnlockAt)}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-brand w-full text-sm py-2 justify-center"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewLockButton;
