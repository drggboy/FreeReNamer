import { useState, type FC } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface RuleNameInputDialogProps {
  open: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export const RuleNameInputDialog: FC<RuleNameInputDialogProps> = ({
  open,
  defaultName,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);

  const handleConfirm = () => {
    onConfirm(name.trim() || defaultName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>请输入规则名称</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ruleName">规则名称</Label>
            <Input
              id="ruleName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={defaultName}
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              取消
            </Button>
            <Button onClick={handleConfirm}>确定</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
