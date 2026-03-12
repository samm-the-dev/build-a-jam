import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/utils';
import { useSheetDismiss } from '@/hooks/useSheetDismiss';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/**
 * RESPONSIVE DIALOG LAYOUT (adapted from the ohm repo):
 *
 * ANGULAR vs REACT (LAYOUT):
 * Angular Material dialogs are always centered and configured via a service.
 * React + Radix gives us composable primitives — we build the responsive
 * layout ourselves with flexbox alignment:
 *
 *   Mobile:  items-end   → bottom sheet (full width, rounded top, drag handle)
 *   Desktop: items-center → centered dialog (max-width, fully rounded)
 *
 * This replaces the previous variant-based approach (DIALOG_DEFAULT / DIALOG_SHEET)
 * which required ~6 lines of responsive class overrides. One flex container
 * that adapts via alignment — much simpler.
 *
 * The onSwipeDismiss prop wires up the useSheetDismiss hook internally.
 * Consumers just pass a callback and get swipe-to-dismiss + drag handle for free:
 *   <DialogContent onSwipeDismiss={onClose}>
 */

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** Callback fired when the user swipes down to dismiss (mobile bottom sheet). */
  onSwipeDismiss?: () => void;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, onSwipeDismiss, ...props }, forwardedRef) => {
  const { sheetRef, touchHandlers } = useSheetDismiss(onSwipeDismiss);

  // Merge the forwarded ref (for external consumers) with the internal
  // sheetRef (for swipe-to-dismiss). Both need access to the same DOM node.
  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      sheetRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef, sheetRef],
  );

  return (
    <DialogPortal>
      <DialogOverlay />
      {/* Flex container: items-end on mobile (bottom sheet), items-center on desktop (centered) */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <DialogPrimitive.Content
          ref={mergedRef}
          className={cn(
            // Base: full-width sheet with top-rounded corners, slide-up entry.
            // pt-0 on mobile because the drag handle provides all top spacing.
            'animate-slide-up relative max-h-[85dvh] w-full overflow-y-auto rounded-t-xl border bg-background p-6 pt-0 shadow-lg',
            // Desktop: restore top padding, constrained width, fully rounded
            'sm:max-h-[80vh] sm:max-w-lg sm:rounded-xl sm:pt-6',
            className,
          )}
          {...touchHandlers}
          {...props}
        >
          {/* Drag handle — mobile only; visual cue for swipe-to-dismiss */}
          <div className="flex justify-center pb-3 pt-3 sm:hidden">
            <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
          </div>
          {children}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
