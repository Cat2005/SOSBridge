'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useToastSteps } from '@/hooks/useToastSteps'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import LocationDisplay from '@/components/LocationDisplay'
import {
  Shield,
  Flame,
  Heart,
  MapPin,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'

const EMERGENCY_SERVICES = [
  {
    id: 'police',
    label: 'Police',
    icon: Shield,
    color: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
    description: 'Crime, safety, security',
  },
  {
    id: 'fire',
    label: 'Fire',
    icon: Flame,
    color: 'bg-red-500 hover:bg-red-600 focus:ring-red-500',
    description: 'Fire, hazmat, rescue',
  },
  {
    id: 'ambulance',
    label: 'Medical',
    icon: Heart,
    color: 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500',
    description: 'Medical emergency',
  },
] as const

type ServiceType = (typeof EMERGENCY_SERVICES)[number]['id']

interface EmergencyData {
  serviceNeeded: string
  description: string
  location: { latitude: number; longitude: number } | null
  manualAddress: string | null
  browserLanguage: string
  timestamp: string
}

interface Props {
  onError: (error: string | null) => void
  onSubmit: (data: EmergencyData) => void
}

export default function EmergencyForm({ onError, onSubmit }: Props) {
  const [selectedService, setSelectedService] = useState<ServiceType | null>(
    null
  )
  const [description, setDescription] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    request: requestLocation,
    coords,
    error: locationError,
    isAllowed,
  } = useGeolocation()
  const toastSteps = useToastSteps()

  const maxChars = 280
  const remainingChars = maxChars - description.length

  const handleLocationRequest = async () => {
    try {
      await requestLocation()
      if (locationError) {
        onError(
          'Location access denied — you can still type an address manually.'
        )
      }
    } catch (err) {
      onError('Unable to access location. Please enter your address manually.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedService) {
      onError('Please select an emergency service')
      return
    }

    if (description.trim().length < 10) {
      onError('Please provide more details about your emergency')
      return
    }

    // Check if we have either coordinates or manual address
    if (!coords && !manualAddress.trim()) {
      onError('Please provide your location or enter your address manually')
      return
    }

    setIsSubmitting(true)
    onError(null)

    try {
      const payload: EmergencyData = {
        serviceNeeded: selectedService,
        description: description.trim(),
        location: coords
          ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
            }
          : null,
        manualAddress: manualAddress.trim() || resolvedAddress || null,
        browserLanguage: navigator.language,
        timestamp: new Date().toISOString(),
      }

      // Call the parent's onSubmit callback with the emergency data
      onSubmit(payload)
    } catch (error) {
      console.error('Emergency request failed:', error)
      toastSteps.error('Failed to prepare emergency request. Please try again.')
      onError(
        'Unable to prepare emergency request. Please try again or call 911 directly.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Service Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Emergency Service Needed
        </label>
        <div className="grid grid-cols-3 gap-3">
          {EMERGENCY_SERVICES.map((service, index) => {
            const Icon = service.icon
            const isSelected = selectedService === service.id

            return (
              <motion.button
                key={service.id}
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedService(service.id)}
                className={`
                  aspect-square relative rounded-xl transition-all duration-200 
                  border-2 focus:outline-none 
                  flex flex-col items-center justify-center space-y-2 p-2
                  ${
                    isSelected
                      ? `${service.color} text-white border-transparent`
                      : 'bg-[#14181F] hover:bg-[#14181F] border-[#14181F] text-slate-300 hover:border-[#14181F]'
                  }
                `}
                aria-label={`Select ${service.label} emergency service`}>
                <Icon
                  className={`w-8 h-8 ${
                    isSelected ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <div className="text-center">
                  <div className="font-medium text-sm">{service.label}</div>
                  <div
                    className={`text-xs mt-1 ${
                      isSelected ? 'text-white/80' : 'text-slate-400'
                    }`}>
                    {service.description}
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle className="w-5 h-5 absolute top-0 right-2" />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-slate-300 mb-2">
          Describe Your Emergency
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please provide details about your emergency situation..."
          maxLength={maxChars}
          rows={4}
          className="resize-none bg-[#14181F] border-[#14181F] ring-0 text-slate-100 placeholder-slate-500"
          aria-describedby="char-count"
        />
        <div
          id="char-count"
          className={`text-xs mt-1 ${
            remainingChars < 20 ? 'text-amber-400' : 'text-slate-400'
          }`}>
          {remainingChars} characters remaining
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Location
        </label>

        <AnimatePresence mode="wait">
          {coords ? (
            <LocationDisplay
              coords={coords}
              onAddressChange={setResolvedAddress}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}>
              {/* Automatic Location Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleLocationRequest}
                disabled={isAllowed === true}
                className={`
                  w-full h-12 justify-start space-x-2 mb-3 transition-all duration-300
                  ${
                    isAllowed === true
                      ? 'border-[#14181F] text-slate-200 hover:bg-[#14181F] hover:border-[#14181F] bg-[#14181F]'
                      : 'border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:border-orange-400 relative overflow-hidden'
                  }
                `}>
                {/* Pulsing background effect when not shared */}
                {isAllowed !== true && (
                  <div className="absolute inset-0 bg-orange-500/20 animate-pulse rounded-md" />
                )}

                <MapPin
                  className={`w-4 h-4 relative z-10 ${
                    isAllowed !== true ? 'ml-3' : ''
                  }`}
                />
                <span className="relative z-10 font-medium">
                  {isAllowed === true
                    ? 'Location Shared'
                    : 'Share Current Location'}
                </span>
                {isAllowed === true && (
                  <Badge variant="secondary" className="ml-auto relative z-10">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Shared
                  </Badge>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Address Input - Only show if location fails */}
        {locationError && (
          <div className="space-y-2">
            <label
              htmlFor="manual-address"
              className="block text-sm font-medium text-slate-300">
              Enter Address Manually
            </label>
            <Input
              id="manual-address"
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Enter your full address (street, city, state, zip)"
              className="bg-[#14181F] border-[#14181F] ring-0 text-slate-100 placeholder-slate-500"
            />
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={
          !selectedService ||
          description.trim().length < 10 ||
          (!coords && !manualAddress.trim() && !resolvedAddress) ||
          isSubmitting
        }
        className="w-full h-14 text-lg font-medium bg-[#14181F] hover:bg-[#14181F] disabled:opacity-50 disabled:cursor-not-allowed">
        {isSubmitting ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Preparing...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Request Emergency Help</span>
          </div>
        )}
      </Button>
    </form>
  )
}
