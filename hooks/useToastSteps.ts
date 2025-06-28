'use client';

import { useCallback } from 'react';
import { toast, Id } from 'react-toastify';

interface UseToastStepsReturn {
  start: (message: string) => Id;
  success: (message: string) => Id;
  error: (message: string) => Id;
  info: (message: string) => Id;
  update: (toastId: Id, message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useToastSteps(): UseToastStepsReturn {
  const start = useCallback((message: string) => {
    return toast.loading(message, {
      position: 'top-center',
      closeButton: false,
    });
  }, []);

  const success = useCallback((message: string) => {
    return toast.success(message, {
      position: 'top-center',
      autoClose: 3000,
    });
  }, []);

  const error = useCallback((message: string) => {
    return toast.error(message, {
      position: 'top-center',
      autoClose: 5000,
    });
  }, []);

  const info = useCallback((message: string) => {
    return toast.info(message, {
      position: 'top-center',
      autoClose: 4000,
    });
  }, []);

  const update = useCallback((toastId: Id, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    toast.update(toastId, {
      render: message,
      type,
      isLoading: false,
      autoClose: type === 'error' ? 5000 : 3000,
    });
  }, []);

  return {
    start,
    success,
    error,
    info,
    update,
  };
}