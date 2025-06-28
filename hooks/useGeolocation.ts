'use client';

import { useState, useCallback } from 'react';

interface GeolocationState {
  coords: GeolocationCoordinates | null;
  error: GeolocationPositionError | null;
  isAllowed: boolean | null;
}

interface UseGeolocationReturn extends GeolocationState {
  request: () => Promise<void>;
}

export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    error: null,
    isAllowed: null,
  });

  const request = useCallback(async () => {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported') as GeolocationPositionError;
      setState(prev => ({ ...prev, error, isAllowed: false }));
      throw error;
    }

    return new Promise<void>((resolve, reject) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            coords: position.coords,
            error: null,
            isAllowed: true,
          });
          resolve();
        },
        (error) => {
          setState(prev => ({
            ...prev,
            error,
            isAllowed: false,
          }));
          reject(error);
        },
        options
      );
    });
  }, []);

  return {
    ...state,
    request,
  };
}