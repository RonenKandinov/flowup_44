/**
 * FlowUp - מדריך מלא למערכת UI
 * ==============================
 * 
 * ## תשתית טכנולוגית
 * 
 * FlowUp משתמש ב-**shadcn/ui** - collection של קומפוננטות מבוססות על:
 * - **Radix UI** - פרימיטיבים נגישים (a11y)
 * - **Tailwind CSS** - עיצוב וסטיילינג
 * - **CVA** (class-variance-authority) - ניהול variants
 * 
 * כל הקומפוננטות ב-`components/ui/` וייבוא: `@/components/ui/[component]`
 * 
 * ---
 * 
 * ## טפסים ואינפוטים
 * 
 * ### Button - components/ui/button.jsx
 * ```jsx
 * import { Button } from "@/components/ui/button";
 * 
 * <Button variant="default">שלח</Button>
 * <Button variant="destructive">מחק</Button>
 * <Button variant="outline">ביטול</Button>
 * <Button variant="ghost">עזרה</Button>
 * <Button variant="link">קישור</Button>
 * <Button size="sm | default | lg | icon">טקסט</Button>
 * ```
 * 
 * ### Input - components/ui/input.jsx
 * ```jsx
 * <Input type="text" placeholder="הזן טקסט..." />
 * <Input type="number" placeholder="מספר..." />
 * <Input type="email" placeholder="דוא״ל..." />
 * ```
 * 
 * ### Textarea - components/ui/textarea.jsx
 * ```jsx
 * <Textarea placeholder="הודעה ארוכה..." rows={5} />
 * ```
 * 
 * ### Label - components/ui/label.jsx
 * ```jsx
 * <Label htmlFor="name">שם</Label>
 * <Input id="name" />
 * ```
 * 
 * ### Checkbox - components/ui/checkbox.jsx
 * ```jsx
 * <Checkbox id="terms" />
 * <label htmlFor="terms">אני מסכים</label>
 * ```
 * 
 * ### Radio Group - components/ui/radio-group.jsx
 * ```jsx
 * <RadioGroup defaultValue="option1">
 *   <RadioGroupItem value="option1" id="r1" />
 *   <Label htmlFor="r1">אפשרות 1</Label>
 * </RadioGroup>
 * ```
 * 
 * ### Switch - components/ui/switch.jsx
 * ```jsx
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 * ```
 * 
 * ### Slider - components/ui/slider.jsx
 * ```jsx
 * <Slider defaultValue={[50]} max={100} step={1} />
 * <Slider defaultValue={[20, 80]} max={100} /> {/* Range */}
 * ```
 * 
 * ### Input OTP - components/ui/input-otp.jsx
 * ```jsx
 * <InputOTP maxLength={6}>
 *   <InputOTPGroup>
 *     <InputOTPSlot index={0} />
 *     <InputOTPSlot index={1} />
 *     <InputOTPSlot index={2} />
 *   </InputOTPGroup>
 * </InputOTP>
 * ```
 * 
 * ### Form (React Hook Form) - components/ui/form.jsx
 * ```jsx
 * const form = useForm();
 * 
 * <Form {...form}>
 *   <form onSubmit={form.handleSubmit(onSubmit)}>
 *     <FormField control={form.control} name="username"
 *       render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>שם משתמש</FormLabel>
 *           <FormControl>
 *             <Input {...field} />
 *           </FormControl>
 *           <FormMessage />
 *         </FormItem>
 *       )}
 *     />
 *     <Button type="submit">שלח</Button>
 *   </form>
 * </Form>
 * ```
 * 
 * ---
 * 
 * ## תפריטים וניווט
 * 
 * ### Select - components/ui/select.jsx
 * ```jsx
 * <Select>
 *   <SelectTrigger>
 *     <SelectValue placeholder="בחר" />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="opt1">אפשרות 1</SelectItem>
 *     <SelectItem value="opt2">אפשרות 2</SelectItem>
 *   </SelectContent>
 * </Select>
 * ```
 * 
 * ### Dropdown Menu - components/ui/dropdown-menu.jsx
 * ```jsx
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild>
 *     <Button>תפריט</Button>
 *   </DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuItem>פעולה 1</DropdownMenuItem>
 *     <DropdownMenuItem>פעולה 2</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 * ```
 * 
 * ### Context Menu - components/ui/context-menu.jsx
 * ```jsx
 * <ContextMenu>
 *   <ContextMenuTrigger>לחץ ימני</ContextMenuTrigger>
 *   <ContextMenuContent>
 *     <ContextMenuItem>העתק</ContextMenuItem>
 *   </ContextMenuContent>
 * </ContextMenu>
 * ```
 * 
 * ### Menubar - components/ui/menubar.jsx
 * ```jsx
 * <Menubar>
 *   <MenubarMenu>
 *     <MenubarTrigger>קובץ</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem>פתח</MenubarItem>
 *     </MenubarContent>
 *   </MenubarMenu>
 * </Menubar>
 * ```
 * 
 * ### Navigation Menu - components/ui/navigation-menu.jsx
 * ```jsx
 * <NavigationMenu>
 *   <NavigationMenuList>
 *     <NavigationMenuItem>
 *       <NavigationMenuTrigger>מוצרים</NavigationMenuTrigger>
 *       <NavigationMenuContent>
 *         <NavigationMenuLink>מוצר 1</NavigationMenuLink>
 *       </NavigationMenuContent>
 *     </NavigationMenuItem>
 *   </NavigationMenuList>
 * </NavigationMenu>
 * ```
 * 
 * ### Breadcrumb - components/ui/breadcrumb.jsx
 * ```jsx
 * <Breadcrumb>
 *   <BreadcrumbList>
 *     <BreadcrumbItem>
 *       <BreadcrumbLink href="/">בית</BreadcrumbLink>
 *     </BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem>
 *       <BreadcrumbPage>נוכחי</BreadcrumbPage>
 *     </BreadcrumbItem>
 *   </BreadcrumbList>
 * </Breadcrumb>
 * ```
 * 
 * ### Command - components/ui/command.jsx
 * ```jsx
 * <Command>
 *   <CommandInput placeholder="חפש..." />
 *   <CommandList>
 *     <CommandItem>פקודה 1</CommandItem>
 *   </CommandList>
 * </Command>
 * ```
 * 
 * ### Tabs - components/ui/tabs.jsx
 * ```jsx
 * <Tabs defaultValue="tab1">
 *   <TabsList>
 *     <TabsTrigger value="tab1">טאב 1</TabsTrigger>
 *     <TabsTrigger value="tab2">טאב 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">תוכן 1</TabsContent>
 *   <TabsContent value="tab2">תוכן 2</TabsContent>
 * </Tabs>
 * ```
 * 
 * ### Pagination - components/ui/pagination.jsx
 * ```jsx
 * <Pagination>
 *   <PaginationContent>
 *     <PaginationItem>
 *       <PaginationPrevious href="#" />
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationLink href="#">1</PaginationLink>
 *     </PaginationItem>
 *     <PaginationItem>
 *       <PaginationNext href="#" />
 *     </PaginationItem>
 *   </PaginationContent>
 * </Pagination>
 * ```
 * 
 * ---
 * 
 * ## חלונות וצפים
 * 
 * ### Dialog - components/ui/dialog.jsx
 * ```jsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>פתח</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>כותרת</DialogTitle>
 *     </DialogHeader>
 *     <p>תוכן</p>
 *   </DialogContent>
 * </Dialog>
 * ```
 * 
 * ### Alert Dialog - components/ui/alert-dialog.jsx
 * ```jsx
 * <AlertDialog>
 *   <AlertDialogTrigger>מחק</AlertDialogTrigger>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>בטוח?</AlertDialogTitle>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>ביטול</AlertDialogCancel>
 *       <AlertDialogAction>אישור</AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 * ```
 * 
 * ### Sheet (Drawer צד) - components/ui/sheet.jsx
 * ```jsx
 * <Sheet>
 *   <SheetTrigger>פתח</SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>תפריט</SheetTitle>
 *     </SheetHeader>
 *   </SheetContent>
 * </Sheet>
 * ```
 * 
 * ### Drawer (תחתון) - components/ui/drawer.jsx
 * ```jsx
 * <Drawer>
 *   <DrawerTrigger>פתח</DrawerTrigger>
 *   <DrawerContent>
 *     <DrawerHeader>
 *       <DrawerTitle>כותרת</DrawerTitle>
 *     </DrawerHeader>
 *   </DrawerContent>
 * </Drawer>
 * ```
 * 
 * ### Popover - components/ui/popover.jsx
 * ```jsx
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button>פתח</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>תוכן</PopoverContent>
 * </Popover>
 * ```
 * 
 * ### Hover Card - components/ui/hover-card.jsx
 * ```jsx
 * <HoverCard>
 *   <HoverCardTrigger>רחף</HoverCardTrigger>
 *   <HoverCardContent>מידע נוסף</HoverCardContent>
 * </HoverCard>
 * ```
 * 
 * ### Tooltip - components/ui/tooltip.jsx
 * ```jsx
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <Button>רחף</Button>
 *     </TooltipTrigger>
 *     <TooltipContent>טיפ</TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 * ```
 * 
 * ---
 * 
 * ## תצוגת תוכן
 * 
 * ### Card - components/ui/card.jsx
 * ```jsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>כותרת</CardTitle>
 *     <CardDescription>תיאור</CardDescription>
 *   </CardHeader>
 *   <CardContent>תוכן</CardContent>
 *   <CardFooter>פוטר</CardFooter>
 * </Card>
 * ```
 * 
 * ### Table - components/ui/table.jsx
 * ```jsx
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>שם</TableHead>
 *       <TableHead>ערך</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>שורה 1</TableCell>
 *       <TableCell>100</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 * ```
 * 
 * ### Accordion - components/ui/accordion.jsx
 * ```jsx
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>שאלה 1</AccordionTrigger>
 *     <AccordionContent>תשובה 1</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 * 
 * ### Collapsible - components/ui/collapsible.jsx
 * ```jsx
 * <Collapsible>
 *   <CollapsibleTrigger>הרחב</CollapsibleTrigger>
 *   <CollapsibleContent>תוכן מוסתר</CollapsibleContent>
 * </Collapsible>
 * ```
 * 
 * ### Carousel - components/ui/carousel.jsx
 * ```jsx
 * <Carousel>
 *   <CarouselContent>
 *     <CarouselItem>סליד 1</CarouselItem>
 *     <CarouselItem>סליד 2</CarouselItem>
 *   </CarouselContent>
 *   <CarouselPrevious />
 *   <CarouselNext />
 * </Carousel>
 * ```
 * 
 * ### Avatar - components/ui/avatar.jsx
 * ```jsx
 * <Avatar>
 *   <AvatarImage src="https://..." />
 *   <AvatarFallback>AB</AvatarFallback>
 * </Avatar>
 * ```
 * 
 * ### Badge - components/ui/badge.jsx
 * ```jsx
 * <Badge variant="default">רגיל</Badge>
 * <Badge variant="secondary">משני</Badge>
 * <Badge variant="destructive">אדום</Badge>
 * <Badge variant="outline">מסגרת</Badge>
 * ```
 * 
 * ### Separator - components/ui/separator.jsx
 * ```jsx
 * <p>טקסט 1</p>
 * <Separator className="my-4" />
 * <p>טקסט 2</p>
 * ```
 * 
 * ### Skeleton - components/ui/skeleton.jsx
 * ```jsx
 * <Skeleton className="h-12 w-12 rounded-full" />
 * <Skeleton className="h-4 w-[250px]" />
 * ```
 * 
 * ---
 * 
 * ## עזרים ופידבקים
 * 
 * ### Alert - components/ui/alert.jsx
 * ```jsx
 * <Alert variant="destructive">
 *   <AlertCircle className="h-4 w-4" />
 *   <AlertTitle>שגיאה</AlertTitle>
 *   <AlertDescription>משהו השתבש</AlertDescription>
 * </Alert>
 * ```
 * 
 * ### Toast - components/ui/sonner.jsx, toast.jsx, toaster.jsx
 * ```jsx
 * // שיטה 1: Sonner (מומלץ)
 * import { toast } from "sonner";
 * toast.success("הצליח!");
 * toast.error("שגיאה!");
 * 
 * // שיטה 2: Radix
 * const { toast } = useToast();
 * toast({ title: "כותרת", description: "תיאור" });
 * ```
 * 
 * ### Progress - components/ui/progress.jsx
 * ```jsx
 * <Progress value={33} />
 * <Progress value={66} className="w-[60%]" />
 * ```
 * 
 * ### Scroll Area - components/ui/scroll-area.jsx
 * ```jsx
 * <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
 *   תוכן ארוך עם גלילה...
 * </ScrollArea>
 * ```
 * 
 * ### Calendar - components/ui/calendar.jsx
 * ```jsx
 * const [date, setDate] = useState(new Date());
 * <Calendar mode="single" selected={date} onSelect={setDate} />
 * ```
 * 
 * ### Chart - components/ui/chart.jsx
 * ```jsx
 * import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
 * import { LineChart, Line } from "recharts";
 * 
 * <ChartContainer config={...}>
 *   <LineChart data={data}>
 *     <Line dataKey="value" />
 *   </LineChart>
 * </ChartContainer>
 * ```
 * 
 * ### Toggle / Toggle Group - components/ui/toggle.jsx, toggle-group.jsx
 * ```jsx
 * <Toggle aria-label="Bold">
 *   <Bold className="h-4 w-4" />
 * </Toggle>
 * 
 * <ToggleGroup type="single">
 *   <ToggleGroupItem value="a">A</ToggleGroupItem>
 *   <ToggleGroupItem value="b">B</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 * 
 * ### Aspect Ratio - components/ui/aspect-ratio.jsx
 * ```jsx
 * <AspectRatio ratio={16 / 9}>
 *   <img src="..." className="rounded-md object-cover" />
 * </AspectRatio>
 * ```
 * 
 * ### Resizable - components/ui/resizable.jsx
 * ```jsx
 * <ResizablePanelGroup direction="horizontal">
 *   <ResizablePanel defaultSize={50}>פאנל 1</ResizablePanel>
 *   <ResizableHandle />
 *   <ResizablePanel defaultSize={50}>פאנל 2</ResizablePanel>
 * </ResizablePanelGroup>
 * ```
 * 
 * ### Sidebar - components/ui/sidebar.jsx
 * ```jsx
 * <SidebarProvider>
 *   <Sidebar>
 *     <SidebarContent>
 *       <SidebarGroup>
 *         <SidebarGroupLabel>תפריט</SidebarGroupLabel>
 *         <SidebarMenu>
 *           <SidebarMenuItem>
 *             <SidebarMenuButton>פריט</SidebarMenuButton>
 *           </SidebarMenuItem>
 *         </SidebarMenu>
 *       </SidebarGroup>
 *     </SidebarContent>
 *   </Sidebar>
 *   <main>תוכן</main>
 * </SidebarProvider>
 * ```
 * 
 * ---
 * 
 * ## ארכיטקטורה
 * 
 * ### שכבות המערכת
 * ```
 * FlowUp Components (Dashboard, SpeedometerGauge...)
 *          ↓
 * shadcn/ui Components (Button, Card, Dialog...)
 *          ↓
 * Radix UI Primitives (Unstyled, accessible)
 *          ↓
 * React + Tailwind CSS
 * ```
 * 
 * ### CVA (Class Variance Authority)
 * ```javascript
 * const buttonVariants = cva(
 *   "base-classes",
 *   {
 *     variants: {
 *       variant: {
 *         default: "bg-primary",
 *         destructive: "bg-red-500"
 *       },
 *       size: {
 *         sm: "h-9 px-3",
 *         lg: "h-11 px-8"
 *       }
 *     }
 *   }
 * );
 * ```
 * 
 * ### cn() Utility
 * ```javascript
 * import { cn } from "@/lib/utils";
 * 
 * <Button className={cn("base", variant && "variant-class", className)} />
 * ```
 * 
 * ### Tailwind + Responsive
 * ```jsx
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
 * <Button className="text-sm md:text-base lg:text-lg">
 * ```
 * 
 * ### נגישות (a11y)
 * - Keyboard navigation אוטומטי
 * - ARIA attributes מובנים
 * - Focus management במודאלים
 * - Screen reader support
 * 
 * ### ביצועים
 * - Tree shaking - רק הקומפוננטות בשימוש נטענות
 * - CSS purging - רק ה-classes המשומשים
 * - Code splitting עם lazy loading
 * - Memoization עם useMemo/memo
 * 
 * ---
 * 
 * ## קומפוננטות מותאמות ל-FlowUp
 * 
 * ### StatCard
 * עוטף Card + מוסיף variants צבעוניים + אנימציות
 * 
 * ### SpeedometerGauge
 * SVG gauge ייחודי עם אנימציות framer-motion
 * 
 * ### WhatIfSimulator
 * משתמש ב-Tabs + לוגיקת חישובי תזרים
 * 
 * ---
 * 
 * ## כללי שימוש
 * 
 * ### אימפורט
 * ```jsx
 * import { Button } from "@/components/ui/button";
 * import { Card } from "@/components/ui/card";
 * ```
 * 
 * ### Variants
 * ```jsx
 * <Button variant="default" size="lg">
 * <Alert variant="destructive">
 * ```
 * 
 * ### Tailwind Override
 * ```jsx
 * <Button className="mt-4 bg-cyan-600">
 * ```
 * 
 * ### Composition
 * ```jsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>כותרת</CardTitle>
 *   </CardHeader>
 *   <CardContent>תוכן</CardContent>
 * </Card>
 * ```
 * 
 * ### Polymorphic (asChild)
 * ```jsx
 * <Button asChild>
 *   <Link to="/page">לינק</Link>
 * </Button>
 * ```
 * 
 * ---
 * 
 * **גרסה:** FlowUp v1.0.0  
 * **עדכון:** 2026-01-12  
 * **מערכת UI:** shadcn/ui + Radix UI + Tailwind CSS
 */

export default null;