'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      expand={true}
      richColors
      closeButton
      theme="system"
    />
  );
}
