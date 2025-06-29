'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import L from 'leaflet'

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Dynamically import the map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

interface LocationDisplayProps {
  coords: { latitude: number; longitude: number } | null
  onAddressChange: (address: string) => void
}

interface AddressData {
  street: string
  city: string
  state: string
  zip: string
  fullAddress: string
}

export default function LocationDisplay({
  coords,
  onAddressChange,
}: LocationDisplayProps) {
  const [address, setAddress] = useState<AddressData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (coords) {
      fetchAddress()
    }
  }, [coords])

  const fetchAddress = async () => {
    if (!coords) return

    setIsLoading(true)
    try {
      // Using OpenStreetMap Nominatim API for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`
      )

      if (!response.ok) throw new Error('Failed to fetch address')

      const data = await response.json()

      // Create a shorter address format: street + zip code
      const street =
        data.address?.road || data.address?.house_number || 'Unknown Street'
      const houseNumber = data.address?.house_number || ''
      const zip = data.address?.postcode || 'Unknown ZIP'

      // Combine street number and name, then add zip
      const shortAddress = houseNumber
        ? `${houseNumber} ${street}, ${zip}`
        : `${street}, ${zip}`

      const addressData: AddressData = {
        street:
          data.address?.road || data.address?.house_number || 'Unknown Street',
        city:
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          'Unknown City',
        state: data.address?.state || 'Unknown State',
        zip: data.address?.postcode || 'Unknown ZIP',
        fullAddress: shortAddress, // Use the shorter format
      }

      setAddress(addressData)
      onAddressChange(shortAddress) // Pass the shorter address format
    } catch (error) {
      console.error('Error fetching address:', error)
      // Fallback to coordinates if geocoding fails
      const fallbackAddress = `${coords.latitude.toFixed(
        6
      )}, ${coords.longitude.toFixed(6)}`
      setAddress({
        street: 'Coordinates',
        city: 'Location',
        state: 'Unknown',
        zip: 'Unknown',
        fullAddress: fallbackAddress,
      })
      onAddressChange(fallbackAddress)
    } finally {
      setIsLoading(false)
    }
  }

  if (!coords) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex">
        {/* Map Section */}
        <div className="w-32 h-24 relative">
          <MapContainer
            center={[coords.latitude, coords.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
            className="rounded-l-lg">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Marker position={[coords.latitude, coords.longitude]} />
          </MapContainer>
        </div>

        {/* Address Section */}
        <div className="flex-1 p-3 flex bg-[#14181F] flex-col justify-center">
          {isLoading ? (
            <div className="flex items-center space-x-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Getting address...</span>
            </div>
          ) : address ? (
            <div className="space-y-1">
              <div className="flex items-center space-x-1 text-slate-300">
                <MapPin className="w-3 h-3 text-emerald-500" />
                <span className="text-xs font-medium">Location Found</span>
              </div>
              <div className="text-xs text-slate-400">
                <div className="font-medium text-slate-300">
                  {address.fullAddress}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Location: {coords.latitude.toFixed(6)},{' '}
              {coords.longitude.toFixed(6)}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
