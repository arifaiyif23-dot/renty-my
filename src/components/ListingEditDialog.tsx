import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ImageUpload';
import { BookingCalendar } from '@/components/BookingCalendar';
import { GripVertical, X, Star } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  category: z.string(),
  price_per_day: z.number().min(1),
  location: z.string().min(2),
  deposit_amount: z.number().min(0),
  minimum_rental_days: z.number().min(1),
  maximum_rental_days: z.number().optional(),
  instant_book_enabled: z.boolean(),
  auto_approve_bookings: z.boolean(),
  item_condition: z.string(),
  cancellation_policy: z.string(),
  tags: z.array(z.string()),
});

interface SortableImageProps {
  id: string;
  url: string;
  isPrimary: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
}

function SortableImage({ id, url, isPrimary, onSetPrimary, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors">
        <img src={url} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-white" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onSetPrimary}>
            <Star className={`h-4 w-4 ${isPrimary ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove}>
            <X className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ListingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: any;
}

export function ListingEditDialog({ open, onOpenChange, listing }: ListingEditDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<Array<{ id: string; url: string; isPrimary: boolean }>>(
    listing?.item_images?.map((img: any, idx: number) => ({
      id: img.id,
      url: img.image_url,
      isPrimary: img.is_primary || idx === 0,
    })) || []
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: listing?.title || '',
      description: listing?.description || '',
      category: listing?.category || '',
      price_per_day: listing?.price_per_day || 0,
      location: listing?.location || '',
      deposit_amount: listing?.deposit_amount || 0,
      minimum_rental_days: listing?.minimum_rental_days || 1,
      maximum_rental_days: listing?.maximum_rental_days || undefined,
      instant_book_enabled: listing?.instant_book_enabled || false,
      auto_approve_bookings: listing?.auto_approve_bookings || false,
      item_condition: listing?.item_condition || 'good',
      cancellation_policy: listing?.cancellation_policy || 'flexible',
      tags: listing?.tags || [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase
        .from('items')
        .update({
          ...values,
          category: values.category as 'electronics' | 'tools' | 'sports' | 'party' | 'vehicles' | 'other',
        })
        .eq('id', listing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      toast.success(t('listings.updateSuccess'));
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to update listing');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{t('listings.editListing')}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="basic" className="w-full pb-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="basic">{t('listingEdit.basicInfo')}</TabsTrigger>
            <TabsTrigger value="pricing">{t('listingEdit.pricing')}</TabsTrigger>
            <TabsTrigger value="images">{t('listingEdit.images')}</TabsTrigger>
            <TabsTrigger value="availability">{t('listingEdit.availability')}</TabsTrigger>
            <TabsTrigger value="details">{t('listingEdit.details')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('listingEdit.analytics')}</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))} className="space-y-6 mt-6">
              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.title')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('listingEdit.titlePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.description')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={6} placeholder={t('listingEdit.descriptionPlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="electronics">Electronics</SelectItem>
                          <SelectItem value="tools">Tools</SelectItem>
                          <SelectItem value="sports">Sports</SelectItem>
                          <SelectItem value="party">Party</SelectItem>
                          <SelectItem value="vehicles">Vehicles</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.location')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <FormField
                  control={form.control}
                  name="price_per_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listingEdit.pricePerDay')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deposit_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listingEdit.depositAmount')}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minimum_rental_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('listingEdit.minimumRentalDays')}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maximum_rental_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('listingEdit.maximumRentalDays')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instant_book_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{t('listingEdit.instantBooking')}</FormLabel>
                        <FormDescription>Allow renters to book instantly without approval</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="auto_approve_bookings"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{t('listingEdit.autoApproveBookings')}</FormLabel>
                        <FormDescription>Automatically approve all booking requests</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="images" className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-4">{t('listingEdit.reorderImages')}</h3>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={images.map((img) => img.id)} strategy={verticalListSortingStrategy}>
                      <div className="grid grid-cols-4 gap-4">
                        {images.map((img) => (
                          <SortableImage
                            key={img.id}
                            id={img.id}
                            url={img.url}
                            isPrimary={img.isPrimary}
                            onSetPrimary={() => {
                              setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.id === img.id })));
                            }}
                            onRemove={() => {
                              setImages((prev) => prev.filter((i) => i.id !== img.id));
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                <ImageUpload
                  onImagesChange={(urls) => {
                    const newImages = urls.map((url, idx) => ({
                      id: crypto.randomUUID(),
                      url,
                      isPrimary: idx === 0,
                    }));
                    setImages(newImages);
                  }}
                  maxImages={10}
                />
              </TabsContent>

              <TabsContent value="availability">
                <BookingCalendar itemId={listing.id} mode="view" />
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <FormField
                  control={form.control}
                  name="item_condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listingEdit.itemCondition')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">{t('listings.new')}</SelectItem>
                          <SelectItem value="like_new">{t('listings.like_new')}</SelectItem>
                          <SelectItem value="good">{t('listings.good')}</SelectItem>
                          <SelectItem value="fair">{t('listings.fair')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cancellation_policy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listings.cancellationPolicy')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="flexible">{t('listings.flexible')}</SelectItem>
                          <SelectItem value="moderate">{t('listings.moderate')}</SelectItem>
                          <SelectItem value="strict">{t('listings.strict')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="analytics">
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('listingEdit.performance')}</p>
                </div>
              </TabsContent>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t('common.loading') : t('listingEdit.saveChanges')}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
