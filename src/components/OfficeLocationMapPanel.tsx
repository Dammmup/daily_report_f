import L from "leaflet";
import { MapPin, Save } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, type OfficeLocation } from "../api";

const defaultOfficePoint = { latitude: 43.238949, longitude: 76.889709 };

type OfficeForm = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  minWeeklyOfficeDays: number;
};

export function OfficeLocationMapPanel({
  location,
  onSaved,
  title = "Офисная точка посещаемости",
  description = "Выберите точку на карте и задайте радиус. Эта настройка применяется ко всем департаментам."
}: {
  location: OfficeLocation | null;
  onSaved: (location: OfficeLocation) => void | Promise<void>;
  title?: string;
  description?: string;
}) {
  const [form, setForm] = useState<OfficeForm>(() => ({
    latitude: location?.latitude || defaultOfficePoint.latitude,
    longitude: location?.longitude || defaultOfficePoint.longitude,
    radiusMeters: location?.radiusMeters || 150,
    minWeeklyOfficeDays: location?.minWeeklyOfficeDays || 2
  }));
  const [saving, setSaving] = useState(false);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    setForm({
      latitude: location?.latitude || defaultOfficePoint.latitude,
      longitude: location?.longitude || defaultOfficePoint.longitude,
      radiusMeters: location?.radiusMeters || 150,
      minWeeklyOfficeDays: location?.minWeeklyOfficeDays || 2
    });
  }, [location]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const center: L.LatLngExpression = [form.latitude, form.longitude];
    const markerIcon = L.divIcon({
      className: "officeMapMarker",
      html: "<span></span>",
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    const map = L.map(mapNodeRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const circle = L.circle(center, {
      radius: form.radiusMeters,
      color: "#10765a",
      fillColor: "#10765a",
      fillOpacity: 0.14,
      weight: 2
    }).addTo(map);
    const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map);

    function setPoint(point: L.LatLng) {
      setForm((current) => ({
        ...current,
        latitude: Number(point.lat.toFixed(6)),
        longitude: Number(point.lng.toFixed(6))
      }));
    }

    marker.on("dragend", () => setPoint(marker.getLatLng()));
    map.on("click", (event: L.LeafletMouseEvent) => setPoint(event.latlng));

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const point: L.LatLngExpression = [form.latitude, form.longitude];
    markerRef.current?.setLatLng(point);
    circleRef.current?.setLatLng(point);
    circleRef.current?.setRadius(form.radiusMeters);
  }, [form.latitude, form.longitude, form.radiusMeters]);

  function useCurrentPosition() {
    navigator.geolocation.getCurrentPosition((position) => {
      const next = {
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6))
      };
      setForm((current) => ({ ...current, ...next }));
      mapRef.current?.setView([next.latitude, next.longitude], Math.max(mapRef.current.getZoom(), 16));
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await api<OfficeLocation>("/api/attendance/office-location/global", {
        method: "PUT",
        body: JSON.stringify(form)
      });
      await onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form officeMapPanel" onSubmit={save}>
      <div className="sectionTitleLine">
        <div>
          <span>Одна точка для компании</span>
          <h2>{title}</h2>
        </div>
        <MapPin size={22} />
      </div>
      <p className="mutedText">{description}</p>
      <div className="officeMapShell">
        <div className="officeMapCanvas" ref={mapNodeRef} />
        <div className="officeMapControls">
          <label>
            Радиус, м
            <input
              type="range"
              min={25}
              max={2000}
              step={25}
              value={form.radiusMeters}
              onChange={(event) => setForm({ ...form, radiusMeters: Number(event.target.value) })}
            />
            <strong>{form.radiusMeters} м</strong>
          </label>
          <label>
            Норма в неделю
            <input
              type="number"
              min={1}
              max={7}
              value={form.minWeeklyOfficeDays}
              onChange={(event) => setForm({ ...form, minWeeklyOfficeDays: Number(event.target.value) })}
            />
          </label>
          <div className="coordinateReadout">
            <span>{form.latitude}</span>
            <span>{form.longitude}</span>
          </div>
          <div className="buttonRow">
            <button className="ghostButton lightButton" type="button" onClick={useCurrentPosition}>
              <MapPin size={16} />
              Мои координаты
            </button>
            <button className="primaryButton" disabled={saving}>
              <Save size={18} />
              {saving ? "Сохраняю..." : "Сохранить точку"}
            </button>
          </div>
        </div>
      </div>
      {location ? (
        <small>
          Текущая точка: {location.latitude}, {location.longitude} · радиус {location.radiusMeters} м · {location.minWeeklyOfficeDays} раз/нед
        </small>
      ) : null}
    </form>
  );
}
