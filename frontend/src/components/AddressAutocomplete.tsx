import React, { useEffect, useRef, useState, useCallback } from 'react';

type PlaceResult = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
};

type AddressAutocompleteProps = {
  onPlaceSelected: (place: PlaceResult) => void;
  className?: string;
  placeholder?: string;
};

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

let googleLoaded = false;
let googleLoading = false;
let placesLib: any = null;

async function loadGooglePlaces(): Promise<any> {
  if (placesLib) return placesLib;
  if (googleLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (placesLib) {
          clearInterval(check);
          resolve(placesLib);
        }
      }, 100);
    });
  }

  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('VITE_GOOGLE_PLACES_API_KEY is not set.');
    throw new Error('Google Places API key not configured');
  }

  googleLoading = true;

  if (!googleLoaded) {
    await new Promise<void>((resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        googleLoaded = true;
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => { googleLoaded = true; resolve(); };
      script.onerror = () => { googleLoading = false; reject(new Error('Failed to load Google Maps')); };
      document.head.appendChild(script);
    });
  }

  placesLib = await google.maps.importLibrary('places');
  googleLoading = false;
  return placesLib;
}

function parseAddressComponents(place: any): PlaceResult {
  const components = place.addressComponents || [];
  let streetNumber = '';
  let route = '';
  let sublocality = '';
  let locality = '';
  let city = '';
  let pincode = '';

  for (const component of components) {
    const types = component.types;
    if (types.includes('street_number')) {
      streetNumber = component.longText;
    } else if (types.includes('route')) {
      route = component.longText;
    } else if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
      sublocality = component.longText;
    } else if (types.includes('locality')) {
      locality = component.longText;
    } else if (types.includes('administrative_area_level_2')) {
      if (!city) city = component.longText;
    } else if (types.includes('postal_code')) {
      pincode = component.longText;
    }
  }

  if (locality) city = locality;

  const addressLine1 = place.displayName || [streetNumber, route].filter(Boolean).join(' ') || '';
  const addressLine2 = sublocality || '';

  return { addressLine1, addressLine2, city, pincode };
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onPlaceSelected,
  className = '',
  placeholder = 'Search for your address...',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placesReady, setPlacesReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  // Load Google Places library
  useEffect(() => {
    loadGooglePlaces()
      .then(() => setPlacesReady(true))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 2 || !placesReady) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const { AutocompleteSuggestion } = placesLib;
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        locationBias: {
          center: { lat: 11.9416, lng: 79.8083 }, // Pondicherry
          radius: 15000,
        },
        includedRegionCodes: ['in'],
      });

      const results: Suggestion[] = (response.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.mainText?.text || s.placePrediction.text?.text || '',
          secondaryText: s.placePrediction.secondaryText?.text || '',
        }));

      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, [placesReady]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setQuery(suggestion.mainText);
    setShowDropdown(false);
    setSuggestions([]);

    try {
      const { Place } = placesLib;
      const place = new Place({ id: suggestion.placeId });
      await place.fetchFields({ fields: ['displayName', 'addressComponents'] });
      const parsed = parseAddressComponents(place);
      onPlaceSelectedRef.current(parsed);
    } catch (err) {
      console.error('Place details error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-green-800 rounded-full animate-spin" />
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.placeId}
              type="button"
              className={`w-full text-left px-4 py-3 flex flex-col transition-colors ${
                i === activeIndex ? 'bg-green-50' : 'hover:bg-gray-50'
              } ${i < suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="text-sm font-medium text-gray-900">{s.mainText}</span>
              {s.secondaryText && (
                <span className="text-xs text-gray-500 mt-0.5">{s.secondaryText}</span>
              )}
            </button>
          ))}
          <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">Powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
};
