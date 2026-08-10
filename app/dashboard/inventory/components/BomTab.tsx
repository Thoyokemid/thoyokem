'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { Bom, Item } from '@/types';
import { Plus, Trash2, Layers } from 'lucide-react';

interface ComponentLine {
  component_item_code: string;
  qty: string;
}

export default function BomTab() {
  const [boms, setBoms] = useState<Bom[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [itemCode, setItemCode] = useState('');
  const [outputQty, setOutputQty] = useState('1');
  const [lines, setLines] = useState<ComponentLine[]>([{ component_item_code: '', qty: '' }]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [bomsRes, itemsRes] = await Promise.all([fetch('/api/boms'), fetch('/api/items')]);
      if (bomsRes.ok) setBoms(await bomsRes.json());
      if (itemsRes.ok) setItems(await itemsRes.json());
    } catch (error) {
      console.error('Error fetching BOMs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setItemCode('');
    setOutputQty('1');
    setLines([{ component_item_code: '', qty: '' }]);
    setError('');
    setIsModalOpen(true);
  };

  const updateLine = (idx: number, field: keyof ComponentLine, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { component_item_code: '', qty: '' }]);
  const removeLine = (idx: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        item_code: itemCode,
        qty: parseFloat(outputQty) || 1,
        components: lines
          .filter((l) => l.component_item_code && l.qty)
          .map((l) => ({ component_item_code: l.component_item_code, qty: parseFloat(l.qty) || 0 })),
      };
      const res = await fetch('/api/boms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setIsModalOpen(false);
        fetchAll();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal membuat BOM');
      }
    } catch (error) {
      console.error('Error creating BOM:', error);
      setError('Gagal membuat BOM');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (bomId: string) => {
    if (!confirm('Hapus BOM ini?')) return;
    try {
      const res = await fetch(`/api/boms?bom_id=${bomId}`, { method: 'DELETE' });
      if (res.ok) fetchAll();
    } catch (error) {
      console.error('Error deleting BOM:', error);
    }
  };

  return (
    <ListViewLayout
      primaryAction={<Button onClick={openNew}><Plus size={14} className="mr-1.5" />New BOM</Button>}
    >
      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        BOM (Bill of Materials) mendefinisikan produk yang merupakan campuran/rakitan dari beberapa item lain. Produksinya lewat Stock Entries → tipe "Manufacture".
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : boms.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">Belum ada BOM. Buat BOM untuk produk campuran.</p>
      ) : (
        boms.map((b) => (
          <ListRow
            key={b.bom_id}
            avatar={<span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center"><Layers size={14} /></span>}
            title={b.item_name || b.item_code}
            subtitle={`${b.bom_id} · Output ${b.qty} · ${b.components.length} komponen`}
            meta={b.components.map((c) => `${c.component_item_name} x${c.qty}`).join(', ')}
            badges={<StatusBadge label={b.is_active ? 'Active' : 'Inactive'} tone={b.is_active ? 'green' : 'gray'} />}
            actions={
              <button onClick={() => handleDelete(b.bom_id)} className="text-red-600 hover:text-red-800 dark:text-red-400"><Trash2 size={14} /></button>
            }
          />
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New BOM (Produk Campuran)" size="lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Produk Hasil Campuran</label>
              <select value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="input-field" required>
                <option value="">Pilih item</option>
                {items.map((i) => (
                  <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Qty Output per Produksi</label>
              <input type="number" min={0.01} step="any" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="label-field">Komponen</label>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select value={line.component_item_code} onChange={(e) => updateLine(idx, 'component_item_code', e.target.value)} className="input-field col-span-8 text-xs" required>
                    <option value="">Item komponen</option>
                    {items.map((i) => (
                      <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                    ))}
                  </select>
                  <input type="number" min={0} step="any" placeholder="Qty" value={line.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} className="input-field col-span-3 text-xs" required />
                  <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1">
              <Plus size={12} /> Add row
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>Create BOM</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
