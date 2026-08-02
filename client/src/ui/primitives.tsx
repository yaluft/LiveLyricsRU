import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

/** Radix primitives styled with the existing Ocean token layer — no layout takeover. */

export function OceanDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = 'modal modal--lyricedit',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim" />
        <Dialog.Content className={className} aria-describedby={description ? 'dialog-desc' : undefined}>
          <Dialog.Title className="modal__title">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description id="dialog-desc" className="sr-only">
              {description}
            </Dialog.Description>
          ) : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function OceanSwitch({
  checked,
  onCheckedChange,
  label,
  compact,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  compact?: boolean;
}): JSX.Element {
  return (
    <label className={`ocean-switch${compact ? ' ocean-switch--sm' : ''}`}>
      <span>{label}</span>
      <Switch.Root className="switch-radix" checked={checked} onCheckedChange={onCheckedChange}>
        <Switch.Thumb className="switch-radix__thumb" />
      </Switch.Root>
    </label>
  );
}

export function OceanTabs({
  tabs,
  value,
  onValueChange,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  value: string;
  onValueChange: (id: string) => void;
}): JSX.Element {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="ocean-tabs">
      <Tabs.List className="ocean-tabs__list">
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.id} value={tab.id} className="ocean-tabs__trigger">
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab.id} value={tab.id} className="ocean-tabs__panel">
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

export function OceanTooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="ocean-tooltip" sideOffset={6}>
            {content}
            <Tooltip.Arrow className="ocean-tooltip__arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
