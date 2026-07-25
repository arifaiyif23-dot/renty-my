import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ListingEditFormData } from '@/types';
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
import { ImageUpload } from '@/components/ImageUpload';
import { UnifiedCalendar } from '@/components/UnifiedCalendar';
import { GripVertical, X, Star } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  category: z.string(),
  price_per_day: z.number().min(1),
  price_per_hour: z.number().optional(),
  payment_mode: z.string().optional(),
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
        <img src={url} alt="Listing image" className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-white" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onSetPrimary}>
            <Star className={`h-4 w-4 ${isPrimary ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
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
  listing: ListingEditFormData;
}

export function ListingEditDialog({ open, onOpenChange, listing }: ListingEditDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<Array<{ id: string; url: string; isPrimary: boolean }>>([]);

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
      price_per_hour: listing?.price_per_hour || undefined,
      payment_mode: listing?.payment_mode || 'per_day',
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

  // Reset form and images when listing changes or dialog opens
  useEffect(() => {
    if (listing && open) {
      form.reset({
        title: listing.title || '',
        description: listing.description || '',
        category: listing.category || '',
        price_per_day: listing.price_per_day || 0,
        price_per_hour: listing.price_per_hour || undefined,
        payment_mode: listing.payment_mode || 'per_day',
        location: listing.location || '',
        deposit_amount: listing.deposit_amount || 0,
        minimum_rental_days: listing.minimum_rental_days || 1,
        maximum_rental_days: listing.maximum_rental_days ?? undefined,
        instant_book_enabled: listing.instant_book_enabled || false,
        auto_approve_bookings: listing.auto_approve_bookings || false,
        item_condition: listing.item_condition || 'good',
        cancellation_policy: listing.cancellation_policy || 'flexible',
        tags: listing.tags || [],
      });

      if (listing.item_images) {
        setImages(
          listing.item_images.map((img: { id: string; image_url: string; is_primary: boolean }, idx: number) => ({
            id: img.id,
            url: img.image_url,
            isPrimary: img.is_primary || idx === 0,
          }))
        );
      }
    }
  }, [listing, open, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      
      // Validate images
      if (images.length === 0) {
        throw new Error('At least one image is required. Please upload an image before saving.');
      }

      // Ensure there's always a primary image
      const updatedImages = [...images];
      if (!updatedImages.some((img) => img.isPrimary) && updatedImages.length > 0) {
        updatedImages[0].isPrimary = true;
      }

      // Update item basic info
      const { error: itemError } = await supabase
        .from('items')
        .update({
          title: values.title,
          description: values.description,
          category: values.category as 'electronics' | 'tools' | 'sports' | 'party' | 'vehicles' | 'fashion' | 'other',
          price_per_day: values.price_per_day,
          price_per_hour: values.price_per_hour,
          payment_mode: values.payment_mode,
          location: values.location,
          deposit_amount: values.deposit_amount,
          minimum_rental_days: values.minimum_rental_days,
          maximum_rental_days: values.maximum_rental_days || null,
          instant_book_enabled: values.instant_book_enabled,
          auto_approve_bookings: values.auto_approve_bookings,
          item_condition: values.item_condition,
          cancellation_policy: values.cancellation_policy,
          tags: values.tags,
        })
        .eq('id', listing.id);
      
      if (itemError) {
        console.error('Item update error:', itemError);
        throw new Error(`Failed to update item: ${itemError.message}`);
      }

      // Update images: save old, insert new, then delete stale old ones
      const { data: oldImages, error: oldImagesError } = await supabase
        .from('item_images')
        .select('id, image_url')
        .eq('item_id', listing.id);

      if (oldImagesError) {
        console.error('Failed to read existing images:', oldImagesError);
      }

      const imageInserts = updatedImages.map((img, index) => ({
        item_id: listing.id,
        image_url: img.url,
        is_primary: img.isPrimary,
        display_order: index,
      }));

      const { error: imageError } = await supabase
        .from('item_images')
        .insert(imageInserts);
      
      if (imageError) {
        console.error('Image insert error:', imageError);
        throw new Error(`Failed to save images: ${imageError.message}`);
      }

      // Delete old images that are no longer in the set
      if (oldImages?.length) {
        const oldUrls = new Set(oldImages.map(img => img.image_url));
        const newUrls = new Set(updatedImages.map(img => img.url));
        const staleUrls = [...oldUrls].filter(url => !newUrls.has(url));
        
        if (staleUrls.length > 0) {
          const { error: deleteError } = await supabase
            .from('item_images')
            .delete()
            .eq('item_id', listing.id)
            .in('image_url', staleUrls);
          
          if (deleteError) {
            console.error('Image delete error:', deleteError);
          }
        }
      }
      
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      toast.success(t('listings.updateSuccess'));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('Update mutation error:', error);
      toast.error(error.message || 'Failed to update listing');
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
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="basic" className="flex-shrink-0">{t('listingEdit.basicInfo')}</TabsTrigger>
            <TabsTrigger value="pricing" className="flex-shrink-0">{t('listingEdit.pricing')}</TabsTrigger>
            <TabsTrigger value="images" className="flex-shrink-0">{t('listingEdit.images')}</TabsTrigger>
            <TabsTrigger value="availability" className="flex-shrink-0">{t('listingEdit.availability')}</TabsTrigger>
            <TabsTrigger value="details" className="flex-shrink-0">{t('listingEdit.details')}</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0">{t('listingEdit.analytics')}</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => {
              updateMutation.mutate(values);
            }, (errors) => {
              console.error('Form validation errors:', errors);
              toast.error('Please fill in all required fields correctly');
            })} className="space-y-6 mt-6">
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                          <SelectItem value="fashion">Fashion</SelectItem>
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
                        <FormDescription>{t('listingEdit.instantBookingDesc')}</FormDescription>
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
                        <FormDescription>{t('listingEdit.autoApproveDesc')}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="images" className="space-y-4">
                {images.length > 0 && (
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
                )}

                <div>
                  <h3 className="text-sm font-medium mb-2">{t('listingEdit.addNewImages')}</h3>
                  <ImageUpload
                    onImagesChange={(urls) => {
                      // Get the last uploaded image URLs (the difference between new and previous)
                      const existingUrls = new Set(images.map((i) => i.url));
                      const addedUrls = urls.filter((url) => !existingUrls.has(url));
                      
                      if (addedUrls.length > 0) {
                        const newImages = addedUrls.map((url) => ({
                          id: crypto.randomUUID(),
                          url,
                          isPrimary: images.length === 0, // First image is primary if no images exist
                        }));
                        setImages((prev) => [...prev, ...newImages]);
                      }
                    }}
                    maxImages={10 - images.length}
                    initialImages={[]}
                  />
                </div>
              </TabsContent>

              <TabsContent value="availability">
                <UnifiedCalendar itemId={listing.id} mode="view" />
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <FormField
                  control={form.control}
                  name="item_condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('listingEdit.itemCondition')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
