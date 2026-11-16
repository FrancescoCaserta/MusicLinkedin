import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Shown inside the pin (e.g. rank in the list). */
  badge?: string;
  tone?: 'ok' | 'warn' | 'plain';
}

/**
 * A map without API keys: Leaflet with OpenStreetMap's own tiles.
 * If tiles cannot load the pins and the radius still render on plain paper.
 */
export function MapView({
  markers,
  center,
  radiusKm,
  activeId,
  onSelect,
  onHover,
  className = '',
  interactive = true,
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number; label?: string };
  radiusKm?: number;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  className?: string;
  interactive?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pins = useRef(new Map<string, L.Marker>());
  const handlers = useRef({ onSelect, onHover });
  handlers.current = { onSelect, onHover };

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      zoomControl: interactive,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: false,
      keyboard: interactive,
      zoomSnap: 0.25,
    }).setView([44.49, 11.34], 7);
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 14,
      minZoom: 3,
      className: 'map__tiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, [interactive]);

  const key = JSON.stringify([markers.map((x) => [x.id, x.lat, x.lng, x.badge, x.tone]), center?.lat, center?.lng, radiusKm]);
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    pins.current.clear();
    const bounds = L.latLngBounds([]);
    if (center) {
      if (radiusKm) {
        const circle = L.circle([center.lat, center.lng], { radius: radiusKm * 1000, color: '#7a1f2b', weight: 1.2, opacity: 0.75, dashArray: '4 5', fillColor: '#7a1f2b', fillOpacity: 0.045, interactive: false }).addTo(g);
        bounds.extend(circle.getBounds());
      }
      L.marker([center.lat, center.lng], { icon: L.divIcon({ className: 'pin-centre', html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false, keyboard: false }).addTo(g);
      bounds.extend([center.lat, center.lng]);
    }
    // Spread people who live in the same city so every pin can be reached.
    const seen = new Map<string, number>();
    for (const x of markers) {
      const k = `${x.lat.toFixed(3)},${x.lng.toFixed(3)}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      const angle = n * 2.4;
      const r = n === 0 ? 0 : 0.012 + 0.006 * Math.sqrt(n);
      const pos: [number, number] = [x.lat + r * Math.sin(angle), x.lng + r * 1.4 * Math.cos(angle)];
      const pin = L.marker(pos, {
        icon: L.divIcon({ className: `pin pin--${x.tone ?? 'plain'}`, html: `<span>${x.badge ?? ''}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: x.label,
        alt: x.label,
        riseOnHover: true,
      }).addTo(g);
      pin.on('click', () => handlers.current.onSelect?.(x.id));
      pin.on('mouseover', () => handlers.current.onHover?.(x.id));
      pin.on('mouseout', () => handlers.current.onHover?.(null));
      pin.bindTooltip(x.label, { direction: 'top', offset: [0, -12], className: 'pin-tip' });
      pins.current.set(x.id, pin);
      bounds.extend(pos);
    }
    if (bounds.isValid()) m.fitBounds(bounds, { padding: [28, 28], maxZoom: 11, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    for (const [id, pin] of pins.current) {
      const node = pin.getElement();
      if (!node) continue;
      node.classList.toggle('is-active', id === activeId);
      pin.setZIndexOffset(id === activeId ? 1000 : 0);
    }
  }, [activeId, key]);

  return <div ref={el} className={`map ${className}`} role="application" aria-label="Map of results" />;
}
