'use client';

import { useEffect, useMemo, useState } from 'react';

import { BottomSheet, useIsKnowledgeMobile } from '@/components/ui/BottomSheet';

type ServicePriceType = 'fixed' | 'from' | 'varies' | 'consultation';

export type StaffDrawerServiceCategory = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type StaffDrawerService = {
  id: string;
  categoryId?: string | null;
  name: string;
  active: boolean;
  bookable: boolean;
  sortOrder: number;
  durationText?: string | null;
  durationMinutes?: number | null;
  priceAmount?: number | null;
  priceCurrency: string;
  priceType: ServicePriceType;
};

export type StaffDrawerServiceCatalog = {
  categories: StaffDrawerServiceCategory[];
  services: StaffDrawerService[];
};

export type StaffWithServices = {
  id: string;
  name: string;
  role: string | null;
  specialties: string[];
  notes: string | null;
  active: boolean;
  allServices: boolean;
  serviceIds: string[];
  syncedFromPlatform: boolean;
  externalProvider: string | null;
};

export type StaffUpdateData = {
  name: string;
  role: string | null;
  specialties: string[];
  notes: string | null;
  active: boolean;
};

type StaffDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffWithServices | null;
  serviceCatalog: StaffDrawerServiceCatalog | null;
  onSaveServices: (staffId: string, allServices: boolean, serviceIds: string[]) => Promise<void>;
};

function serviceDurationLabel(service: StaffDrawerService) {
  if (service.durationText?.trim()) return service.durationText.trim();
  if (service.durationMinutes) return `${service.durationMinutes} min`;
  return null;
}

export function StaffDrawer({
  isOpen,
  onClose,
  staff,
  serviceCatalog,
  onSaveServices,
}: StaffDrawerProps) {
  const isMobile = useIsKnowledgeMobile();
  const [allServices, setAllServices] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAllServices(staff?.allServices !== false);
    setSelectedServiceIds(staff?.serviceIds ?? []);
    setSaving(false);
    setError(null);
  }, [isOpen, staff]);

  const serviceGroups = useMemo(() => {
    const categories = [...(serviceCatalog?.categories ?? [])]
      .filter((category) => category.active !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const uncategorized = { id: 'uncategorized', name: 'General services', sortOrder: 9999, active: true };
    const byCategory = new Map<string, StaffDrawerServiceCategory>(categories.map((category) => [category.id, category]));
    const services = [...(serviceCatalog?.services ?? [])]
      .filter((service) => service.active !== false && service.bookable !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const groups = new Map<string, { category: StaffDrawerServiceCategory; services: StaffDrawerService[] }>();
    for (const service of services) {
      const category = service.categoryId && byCategory.has(service.categoryId)
        ? byCategory.get(service.categoryId)!
        : uncategorized;
      const group = groups.get(category.id) ?? { category, services: [] };
      group.services.push(service);
      groups.set(category.id, group);
    }
    return [...groups.values()].sort(
      (a, b) => a.category.sortOrder - b.category.sortOrder || a.category.name.localeCompare(b.category.name),
    );
  }, [serviceCatalog]);

  const allAvailableServiceIds = useMemo(
    () => serviceGroups.flatMap((group) => group.services.map((service) => service.id)),
    [serviceGroups],
  );

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) => {
      const selected = new Set(allServices ? allAvailableServiceIds : current);
      if (selected.has(serviceId)) selected.delete(serviceId);
      else selected.add(serviceId);
      return [...selected];
    });
    setAllServices(false);
  }

  function toggleCategory(serviceIds: string[]) {
    setSelectedServiceIds((current) => {
      const selected = new Set(allServices ? allAvailableServiceIds : current);
      const everySelected = serviceIds.every((id) => selected.has(id));
      if (everySelected) {
        serviceIds.forEach((id) => selected.delete(id));
      } else {
        serviceIds.forEach((id) => selected.add(id));
      }
      return [...selected];
    });
    setAllServices(false);
  }

  async function handleSave() {
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveServices(staff.id, allServices, allServices ? [] : selectedServiceIds);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'staff_services_save_failed');
    } finally {
      setSaving(false);
    }
  }

  const serviceSummary = allServices
    ? 'All services'
    : `${selectedServiceIds.length} service${selectedServiceIds.length === 1 ? '' : 's'} assigned`;
  const drawerTitle = 'Assign services';
  const staffName = staff?.name?.trim() || 'Staff member';

  const content = (
    <div className="staff-drawer-shell">
      <div className="staff-drawer-scroll">
        <section className="staff-drawer-section">
          <div className="staff-drawer-section-head">
            <div>
              <div className="staff-drawer-section-title">services</div>
              <p>{staffName} can perform: {serviceSummary.toLowerCase()}</p>
            </div>
            <div className={`staff-drawer-service-badge ${allServices ? 'all' : 'custom'}`}>
              <span aria-hidden />
              {serviceSummary}
            </div>
          </div>

          <div className="staff-service-editor">
            <div className="staff-service-editor-actions">
              <button type="button" onClick={() => {
                setAllServices(false);
                setSelectedServiceIds(allAvailableServiceIds);
              }}>
                Select all
              </button>
              <button type="button" onClick={() => {
                setAllServices(false);
                setSelectedServiceIds([]);
              }}>
                Clear all
              </button>
              <button type="button" onClick={() => {
                setAllServices(true);
                setSelectedServiceIds([]);
              }}>
                Reset to all
              </button>
            </div>

            {serviceGroups.length === 0 ? (
              <p className="staff-drawer-muted">No services available yet.</p>
            ) : (
              serviceGroups.map((group) => {
                const ids = group.services.map((service) => service.id);
                const selectedCount = allServices ? ids.length : ids.filter((id) => selectedServiceIds.includes(id)).length;
                const allSelected = selectedCount === ids.length && ids.length > 0;
                return (
                  <div className="staff-service-group" key={group.category.id}>
                    <button type="button" className="staff-service-group-head" onClick={() => toggleCategory(ids)}>
                      <span>{group.category.name}</span>
                      <small>{selectedCount}/{ids.length}</small>
                    </button>
                    <div className="staff-service-list">
                      {group.services.map((service) => {
                        const selected = allServices || selectedServiceIds.includes(service.id);
                        return (
                          <label className="staff-service-row" key={service.id}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleService(service.id)}
                            />
                            <span>
                              <strong>{service.name}</strong>
                              {serviceDurationLabel(service) ? <small>{serviceDurationLabel(service)}</small> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {allSelected ? null : <div className="staff-service-partial" aria-hidden />}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="staff-drawer-footer">
        {error ? <div className="staff-drawer-error">{error}</div> : null}
        <button type="button" className="staff-drawer-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="staff-drawer-primary" onClick={handleSave} disabled={saving || !staff}>
          {saving ? 'Saving...' : 'Save services'}
        </button>
      </div>
      <style jsx>{`
        .staff-drawer-shell {
          display: flex;
          min-height: 100%;
          flex-direction: column;
          background: #fff;
          color: #111827;
        }
        .staff-drawer-scroll {
          flex: 1;
          overflow: auto;
          padding: 20px;
        }
        .staff-drawer-section {
          padding: 0 0 20px;
        }
        .staff-drawer-section-title {
          color: #6b7280;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0;
          margin-bottom: 8px;
          text-transform: lowercase;
        }
        .staff-drawer-section-head {
          align-items: flex-start;
          display: flex;
          gap: 12px;
          justify-content: space-between;
        }
        .staff-drawer-section-head p,
        .staff-drawer-muted {
          color: #6b7280;
          font-size: 13px;
          margin: 2px 0 0;
        }
        .staff-service-editor {
          margin-top: 14px;
        }
        .staff-service-editor-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .staff-service-editor-actions button,
        .staff-drawer-secondary,
        .staff-drawer-primary {
          border-radius: 8px;
          cursor: pointer;
          font: inherit;
          min-height: 40px;
          padding: 9px 12px;
        }
        .staff-service-editor-actions button,
        .staff-drawer-secondary {
          background: #fff;
          border: 1px solid #d9dde5;
          color: #111827;
        }
        .staff-drawer-service-badge {
          align-items: center;
          border: 1px solid #d9dde5;
          border-radius: 12px;
          display: inline-flex;
          flex-shrink: 0;
          gap: 8px;
          padding: 10px 12px;
          white-space: nowrap;
        }
        .staff-drawer-service-badge span {
          background: #10b981;
          border-radius: 50%;
          height: 8px;
          width: 8px;
        }
        .staff-drawer-service-badge.custom span {
          background: #f59e0b;
        }
        .staff-service-group {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          margin-top: 10px;
          overflow: hidden;
          position: relative;
        }
        .staff-service-group-head {
          align-items: center;
          background: #f9fafb;
          border: 0;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          font: inherit;
          justify-content: space-between;
          min-height: 42px;
          padding: 10px 12px;
          text-align: left;
          width: 100%;
        }
        .staff-service-group-head span {
          font-weight: 650;
        }
        .staff-service-group-head small {
          color: #6b7280;
        }
        .staff-service-list {
          display: grid;
        }
        .staff-service-row {
          align-items: center;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          gap: 10px;
          padding: 10px 12px;
        }
        .staff-service-row:last-child {
          border-bottom: 0;
        }
        .staff-service-row input {
          height: 18px;
          width: 18px;
        }
        .staff-service-row strong {
          display: block;
          font-size: 14px;
          font-weight: 600;
        }
        .staff-service-row small {
          color: #6b7280;
          display: block;
          font-size: 12px;
          margin-top: 2px;
        }
        .staff-service-partial {
          background: #f59e0b;
          height: 3px;
          inset: auto 0 0;
          position: absolute;
        }
        .staff-drawer-footer {
          align-items: center;
          background: #fff;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding: 14px 20px;
          position: sticky;
          bottom: 0;
        }
        .staff-drawer-error {
          color: #b91c1c;
          font-size: 13px;
          margin-right: auto;
        }
        .staff-drawer-primary {
          background: #111827;
          border: 1px solid #111827;
          color: #fff;
          min-width: 126px;
        }
        .staff-drawer-primary:disabled,
        .staff-drawer-secondary:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        @media (max-width: 860px) {
          .staff-drawer-scroll {
            max-height: calc(85vh - 88px);
            padding: 16px;
          }
          .staff-drawer-footer {
            padding: 12px 16px;
          }
          .staff-drawer-section-head {
            display: grid;
          }
          .staff-drawer-service-badge {
            justify-self: start;
          }
        }
      `}</style>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={drawerTitle}
      >
        {content}
      </BottomSheet>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="staff-drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="staff-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={drawerTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="staff-drawer-header">
          <div>
            <h3>{drawerTitle}</h3>
            <p>{staffName}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>
        {content}
      </aside>
      <style jsx>{`
        .staff-drawer-overlay {
          align-items: stretch;
          background: rgba(17, 24, 39, 0.32);
          display: flex;
          inset: 0;
          justify-content: flex-end;
          position: fixed;
          z-index: 70;
        }
        .staff-drawer-panel {
          animation: staffDrawerEnter 180ms ease-out;
          background: #fff;
          box-shadow: -18px 0 40px rgba(17, 24, 39, 0.18);
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 100vw;
          width: 420px;
        }
        .staff-drawer-header {
          align-items: center;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          padding: 18px 20px;
        }
        .staff-drawer-header h3 {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.2;
          margin: 0;
        }
        .staff-drawer-header p {
          color: #6b7280;
          font-size: 13px;
          margin: 4px 0 0;
        }
        .staff-drawer-header button {
          align-items: center;
          background: #fff;
          border: 1px solid #d9dde5;
          border-radius: 8px;
          color: #111827;
          cursor: pointer;
          display: inline-flex;
          font-size: 20px;
          height: 36px;
          justify-content: center;
          width: 36px;
        }
        @keyframes staffDrawerEnter {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
