'use client';

import { useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { useBatches, useItems } from '@/hooks/use-supabase';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Batch } from '@/lib/db';
import { cleanWholeNumberInput, formatMoney, formatNumber, parseWholeNumberInput } from '@/lib/number-format';

export function BatchesManager() {
  const { t } = useLanguage();
  const { currentShopId } = useAuth();
  const { batches, createBatch, getExpiringBatches, deleteBatch } = useBatches(currentShopId);
  const { items } = useItems(currentShopId);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const expiringBatches = batches.filter(b => b.status === 'expiring' || b.status === 'expired');

  const handleCreateBatch = async () => {
    if (!selectedItem || !quantity || !cost) {
      toast.error('Fill all required fields');
      return;
    }

    const item = items.find(i => i.id === selectedItem);
    if (!item) return;

    const newBatch: Omit<Batch, 'id'> = {
      itemId: selectedItem,
      itemName: item.name,
      batchNumber: batchNumber || `BATCH-${Date.now()}`,
      purchaseDate: Date.now(),
      expiryDate: expiryDate ? new Date(expiryDate).getTime() : undefined,
      quantityReceived: parseWholeNumberInput(quantity),
      quantitySold: 0,
      quantityAvailable: parseWholeNumberInput(quantity),
      costPerUnit: parseWholeNumberInput(cost),
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await createBatch(newBatch);
    toast.success('Batch created successfully');
    setSelectedItem(null);
    setBatchNumber('');
    setQuantity('');
    setCost('');
    setExpiryDate('');
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold">Batch Tracking</h1>
        <p className="text-muted-foreground mt-2">Track inventory by batch/lot with expiry dates</p>
      </div>

      {/* Expiring Alert */}
      {expiringBatches.length > 0 && (
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertTriangle className="w-5 h-5" />
              Expiring Soon: {expiringBatches.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringBatches.map(batch => (
                <div key={batch.id} className="flex justify-between items-center p-2 bg-white rounded border border-orange-200">
                  <div>
                    <p className="font-semibold">{batch.itemName}</p>
                    <p className="text-xs text-muted-foreground">Available: {formatNumber(batch.quantityAvailable)}</p>
                  </div>
                  <p className="text-sm font-bold text-orange-600">
                    {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'No date'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Batch Button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button className="w-full bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add New Batch
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Add Batch/Lot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Product</label>
              <select
                value={selectedItem || ''}
                onChange={(e) => setSelectedItem(parseInt(e.target.value))}
                className="w-full p-2 border rounded mt-1"
              >
                <option value="">Select product</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold">Batch Number (Optional)</label>
              <Input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="E.g., LOT-2024-001"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Quantity Received</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(e) => setQuantity(cleanWholeNumberInput(e.target.value))}
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Cost per Unit</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={cost}
                onChange={(e) => setCost(cleanWholeNumberInput(e.target.value))}
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Expiry Date (Optional)</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <Button onClick={handleCreateBatch} className="w-full bg-blue-600">
              Create Batch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batches List */}
      <div className="space-y-3">
        {batches.map(batch => (
          <Card key={batch.id} className="border-2">
            <CardContent className="pt-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{batch.itemName}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Batch</p>
                      <p className="font-semibold">{batch.batchNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available</p>
                      <p className="font-semibold">{formatNumber(batch.quantityAvailable)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost/Unit</p>
                      <p className="font-semibold">Rs. {formatMoney(batch.costPerUnit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expiry</p>
                      <p className={`font-semibold ${batch.status === 'expired' ? 'text-red-600' : batch.status === 'expiring' ? 'text-orange-600' : ''}`}>
                        {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteBatch(batch.id!)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {batches.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-muted-foreground">No batches tracked yet. Add one to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
