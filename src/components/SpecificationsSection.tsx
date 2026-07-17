import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemCategory } from '@/types';

const categorySpecLabels: Record<ItemCategory, { key: string; label: string }[]> = {
  electronics: [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'year', label: 'Year' },
    { key: 'color', label: 'Color' },
    { key: 'storage', label: 'Storage' },
    { key: 'ram', label: 'RAM' },
  ],
  vehicles: [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'year', label: 'Year' },
    { key: 'mileage', label: 'Mileage (km)' },
    { key: 'fuel_type', label: 'Fuel Type' },
    { key: 'transmission', label: 'Transmission' },
  ],
  tools: [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'power_source', label: 'Power Source' },
    { key: 'weight', label: 'Weight (kg)' },
  ],
  sports: [
    { key: 'brand', label: 'Brand' },
    { key: 'size', label: 'Size' },
    { key: 'condition', label: 'Condition' },
  ],
  fashion: [
    { key: 'brand', label: 'Brand' },
    { key: 'size', label: 'Size' },
    { key: 'color', label: 'Color' },
    { key: 'material', label: 'Material' },
  ],
  party: [
    { key: 'theme', label: 'Theme' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'includes', label: 'Includes' },
  ],
  other: [],
};

interface SpecificationsSectionProps {
  specifications: Record<string, string>;
  category: ItemCategory;
}

export default function SpecificationsSection({ specifications, category }: SpecificationsSectionProps) {
  if (!specifications || Object.keys(specifications).length === 0) return null;

  const knownFields = categorySpecLabels[category] || [];
  const knownKeys = new Set(knownFields.map(f => f.key));

  const rows = knownFields
    .filter(f => specifications[f.key])
    .map(f => ({ key: f.key, label: f.label, value: specifications[f.key] }));

  const customRows = Object.entries(specifications)
    .filter(([k]) => !knownKeys.has(k))
    .map(([key, value]) => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value }));

  const allRows = [...rows, ...customRows];

  if (allRows.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Specifications</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <tbody>
            {allRows.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="py-2 pr-4 text-muted-foreground w-1/3">{row.label}</td>
                <td className="py-2 font-medium">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export { categorySpecLabels };
