import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { TOO_MANY_GUYS_MESSAGE } from '../../lib/coed';

interface TooManyGuysDialogProps {
  open: boolean;
  minGirls: number;
  onDismiss: () => void;
}

export function TooManyGuysDialog({ open, minGirls, onDismiss }: TooManyGuysDialogProps) {
  return (
    <Dialog
      open={open}
      title={TOO_MANY_GUYS_MESSAGE}
      onClose={onDismiss}
      footer={
        <Button variant="primary" onClick={onDismiss}>
          Dismiss
        </Button>
      }
    >
      <p role="alert" className="text-sm">
        This team needs at least {minGirls} {minGirls === 1 ? 'girl' : 'girls'} on the field before another guy can go on.
      </p>
    </Dialog>
  );
}
