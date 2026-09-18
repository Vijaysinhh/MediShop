export const medicineFields = {
  genericName: 'generic_name', strength: 'strength', dosageForm: 'dosage_form',
  packType: 'pack_type', shelfLocation: 'shelf_location', batchNumber: 'batch_number',
  gstRate: 'gst_rate', requiresPrescription: 'requires_prescription', coldStorage: 'cold_storage',
  supplierName: 'supplier_name', supplierPhone: 'supplier_phone',
} as const;
export const refillFields = {
  repeatMedicine: 'repeat_medicine', repeatEveryDays: 'repeat_every_days', lastPurchaseDate: 'last_purchase_date',
} as const;

export function pharmacyRow(values: Record<string, any>, fields: Record<string, string>) {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(fields)) {
    if (values[key] !== undefined) row[column] = values[key] === '' ? null : values[key];
  }
  if ('gst_rate' in row && row.gst_rate !== null && (!Number.isFinite(Number(row.gst_rate)) || Number(row.gst_rate) < 0 || Number(row.gst_rate) > 100)) {
    throw new Error('GST must be a percentage between 0 and 100.');
  }
  if ('repeat_every_days' in row && row.repeat_every_days !== null && (!Number.isInteger(Number(row.repeat_every_days)) || Number(row.repeat_every_days) < 1 || Number(row.repeat_every_days) > 3650)) {
    throw new Error('Refill interval must be between 1 and 3650 days.');
  }
  return row;
}

export function readMedicineFields(row: Record<string, any>) {
  return {
    genericName: row.generic_name || '', strength: row.strength || '', dosageForm: row.dosage_form || '',
    packType: row.pack_type || '', shelfLocation: row.shelf_location || '', batchNumber: row.batch_number || '',
    gstRate: row.gst_rate == null ? null : Number(row.gst_rate),
    requiresPrescription: Boolean(row.requires_prescription), coldStorage: Boolean(row.cold_storage),
    supplierName: row.supplier_name || '', supplierPhone: row.supplier_phone || '',
  };
}
