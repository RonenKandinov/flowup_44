/**
 * FlowUp - מדריך קומפוננטות UI
 * ================================
 * 
 * ## סקירה כללית
 * 
 * FlowUp משתמשת בקומפוננטות shadcn/ui - ספריית קומפוננטות מודרנית המבוססת על:
 * - Radix UI - פרימיטיבים נגישים (a11y)
 * - Tailwind CSS - עיצוב וסטיילינג
 * - class-variance-authority (CVA) - ניהול variants
 * 
 * כל הקומפוננטות נמצאות ב-`components/ui/` ומיובאות ישירות מ-`@/components/ui/[component]`
 * 
 * ---
 * 
 * ## קבוצת 1: טפסים ואינפוטים
 * 
 * ### Button
 * **מיקום:** `components/ui/button.jsx`
 * **שימוש:**
 * ```jsx
 * import { Button } from "@/components/ui/button";
 * 
 * <Button variant="default">שלח</Button>
 * <Button variant="destructive">מחק</Button>
 * <Button variant="outline">ביטול</Button>
 * <Button variant="ghost">עזרה</Button>
 * <Button variant="link">קישור</Button>
 * 
 * <Button size="default">רגיל</Button>
 * <Button size="sm">קטן</Button>
 * <Button size="lg">גדול</Button>
 * <Button size="icon"><Icon /></Button>
 * ```
 * 
 * ### Input
 * **מיקום:** `components/ui/input.jsx`
 * **שימוש:**
 * ```jsx
 * import { Input } from "@/components/ui/input";
 * 
 * <Input type="text" placeholder="הזן טקסט..." />
 * <Input type="number" placeholder="הזן מספר..." />
 * <Input type="email" placeholder="דוא״ל..." />
 * <Input disabled value="לא ניתן לעריכה" />
 * ```
 * 
 * ### Textarea
 * **מיקום:** `components/ui/textarea.jsx`
 * **שימוש:**
 * ```jsx
 * import { Textarea } from "@/components/ui/textarea";
 * 
 * <Textarea placeholder="כתוב הודעה ארוכה..." rows={5} />
 * ```
 * 
 * ### Label
 * **מיקום:** `components/ui/label.jsx`
 * **שימוש:**
 * ```jsx
 * import { Label } from "@/components/ui/label";
 * import { Input } from "@/components/ui/input";
 * 
 * <Label htmlFor="name">שם</Label>
 * <Input id="name" type="text" />
 * ```
 * 
 * ### Checkbox
 * **מיקום:** `components/ui/checkbox.jsx`
 * **שימוש:**
 * ```jsx
 * import { Checkbox } from "@/components/ui/checkbox";
 * 
 * <Checkbox id="terms" />
 * <label htmlFor="terms">אני מסכים לתנאים</label>
 * ```
 * 
 * ### Radio Group
 * **מיקום:** `components/ui/radio-group.jsx`
 * **שימוש:**
 * ```jsx
 * import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
 * import { Label } from "@/components/ui/label";
 * 
 * <RadioGroup defaultValue="option1">
 *   <div className="flex items-center gap-2">
 *     <RadioGroupItem value="option1" id="r1" />
 *     <Label htmlFor="r1">אפשרות 1</Label>
 *   </div>
 *   <div className="flex items-center gap-2">
 *     <RadioGroupItem value="option2" id="r2" />
 *     <Label htmlFor="r2">אפשרות 2</Label>
 *   </div>
 * </RadioGroup>
 * ```
 * 
 * ### Switch
 * **מיקום:** `components/ui/switch.jsx`
 * **שימוש:**
 * ```jsx
 * import { Switch } from "@/components/ui/switch";
 * 
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 * ```
 * 
 * ### Slider
 * **מיקום:** `components/ui/slider.jsx`
 * **שימוש:**
 * ```jsx
 * import { Slider } from "@/components/ui/slider";
 * 
 * <Slider defaultValue={[50]} max={100} step={1} />
 * <Slider defaultValue={[20, 80]} max={100} step={1} /> {/* Range */}
 * ```
 * 
 * ### Input OTP
 * **מיקום:** `components/ui/input-otp.jsx`
 * **שימוש:**
 * ```jsx
 * import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
 * 
 * <InputOTP maxLength={6}>
 *   <InputOTPGroup>
 *     <InputOTPSlot index={0} />
 *     <InputOTPSlot index={1} />
 *     <InputOTPSlot index={2} />
 *   </InputOTPGroup>
 * </InputOTP>
 * ```
 * 
 * ### Form (React Hook Form)
 * **מיקום:** `components/ui/form.jsx`
 * **שימוש:**
 * ```jsx
 * import { useForm } from "react-hook-form";
 * import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
 * import { Input } from "@/components/ui/input";
 * import { Button } from "@/components/ui/button";
 * 
 * const form = useForm();
 * 
 * <Form {...form}>
 *   <form onSubmit={form.handleSubmit(onSubmit)}>
 *     <FormField
 *       control={form.control}
 *       name="username"
 *       render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>שם משתמש</FormLabel>
 *           <FormControl>
 *             <Input placeholder="הזן שם משתמש" {...field} />
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
 * ## קבוצת 2: תפריטים וניווט
 * 
 * ### Select
 * **מיקום:** `components/ui/select.jsx`
 * **שימוש:**
 * ```jsx
 * import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 * 
 * <Select>
 *   <SelectTrigger>
 *     <SelectValue placeholder="בחר אפשרות" />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="option1">אפשרות 1</SelectItem>
 *     <SelectItem value="option2">אפשרות 2</SelectItem>
 *     <SelectItem value="option3">אפשרות 3</SelectItem>
 *   </SelectContent>
 * </Select>
 * ```
 * 
 * ### Dropdown Menu
 * **מיקום:** `components/ui/dropdown-menu.jsx`
 * **שימוש:**
 * ```jsx
 * import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
 * import { Button } from "@/components/ui/button";
 * 
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild>
 *     <Button variant="outline">פתח תפריט</Button>
 *   </DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuItem>פעולה 1</DropdownMenuItem>
 *     <DropdownMenuItem>פעולה 2</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 * ```
 * 
 * ### Context Menu
 * **מיקום:** `components/ui/context-menu.jsx`
 * **שימוש:**
 * ```jsx
 * import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
 * 
 * <ContextMenu>
 *   <ContextMenuTrigger>לחץ ימני כאן</ContextMenuTrigger>
 *   <ContextMenuContent>
 *     <ContextMenuItem>העתק</ContextMenuItem>
 *     <ContextMenuItem>הדבק</ContextMenuItem>
 *   </ContextMenuContent>
 * </ContextMenu>
 * ```
 * 
 * ### Menubar
 * **מיקום:** `components/ui/menubar.jsx`
 * **שימוש:**
 * ```jsx
 * import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
 * 
 * <Menubar>
 *   <MenubarMenu>
 *     <MenubarTrigger>קובץ</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem>פתח</MenubarItem>
 *       <MenubarItem>שמור</MenubarItem>
 *     </MenubarContent>
 *   </MenubarMenu>
 * </Menubar>
 * ```
 * 
 * ### Navigation Menu
 * **מיקום:** `components/ui/navigation-menu.jsx`
 * **שימוש:**
 * ```jsx
 * import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
 * 
 * <NavigationMenu>
 *   <NavigationMenuList>
 *     <NavigationMenuItem>
 *       <NavigationMenuTrigger>מוצרים</NavigationMenuTrigger>
 *       <NavigationMenuContent>
 *         <NavigationMenuLink>מוצר 1</NavigationMenuLink>
 *         <NavigationMenuLink>מוצר 2</NavigationMenuLink>
 *       </NavigationMenuContent>
 *     </NavigationMenuItem>
 *   </NavigationMenuList>
 * </NavigationMenu>
 * ```
 * 
 * ### Breadcrumb
 * **מיקום:** `components/ui/breadcrumb.jsx`
 * **שימוש:**
 * ```jsx
 * import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
 * 
 * <Breadcrumb>
 *   <BreadcrumbList>
 *     <BreadcrumbItem>
 *       <BreadcrumbLink href="/">בית</BreadcrumbLink>
 *     </BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem>
 *       <BreadcrumbPage>דף נוכחי</BreadcrumbPage>
 *     </BreadcrumbItem>
 *   </BreadcrumbList>
 * </Breadcrumb>
 * ```
 * 
 * ### Command
 * **מיקום:** `components/ui/command.jsx`
 * **שימוש:**
 * ```jsx
 * import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
 * 
 * <Command>
 *   <CommandInput placeholder="חפש פקודה..." />
 *   <CommandList>
 *     <CommandItem>פקודה 1</CommandItem>
 *     <CommandItem>פקודה 2</CommandItem>
 *   </CommandList>
 * </Command>
 * ```
 * 
 * ### Tabs
 * **מיקום:** `components/ui/tabs.jsx`
 * **שימוש בפרויקט:**
 * ```jsx
 * import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 * 
 * <Tabs defaultValue="tab1">
 *   <TabsList>
 *     <TabsTrigger value="tab1">טאב 1</TabsTrigger>
 *     <TabsTrigger value="tab2">טאב 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">תוכן טאב 1</TabsContent>
 *   <TabsContent value="tab2">תוכן טאב 2</TabsContent>
 * </Tabs>
 * 
 * // דוגמה: WhatIfSimulator משתמש בטאבים
 * ```
 * 
 * ### Pagination
 * **מיקום:** `components/ui/pagination.jsx`
 * **שימוש:**
 * ```jsx
 * import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
 * 
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
 * ## קבוצת 3: חלונות מודאליים ופופאפים
 * 
 * ### Dialog
 * **מיקום:** `components/ui/dialog.jsx`
 * **שימוש בפרויקט:**
 * ```jsx
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 * import { Button } from "@/components/ui/button";
 * 
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>פתח</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>כותרת</DialogTitle>
 *     </DialogHeader>
 *     <p>תוכן הדיאלוג</p>
 *   </DialogContent>
 * </Dialog>
 * ```
 * 
 * ### Alert Dialog
 * **מיקום:** `components/ui/alert-dialog.jsx`
 * **שימוש:**
 * ```jsx
 * import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
 * 
 * <AlertDialog>
 *   <AlertDialogTrigger>מחק</AlertDialogTrigger>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
 *       <AlertDialogDescription>
 *         פעולה זו לא ניתנת לביטול
 *       </AlertDialogDescription>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>ביטול</AlertDialogCancel>
 *       <AlertDialogAction>אישור</AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 * ```
 * 
 * ### Sheet (Drawer צד)
 * **מיקום:** `components/ui/sheet.jsx`
 * **שימוש:**
 * ```jsx
 * import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
 * 
 * <Sheet>
 *   <SheetTrigger>פתח תפריט</SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>תפריט צד</SheetTitle>
 *     </SheetHeader>
 *     <p>תוכן...</p>
 *   </SheetContent>
 * </Sheet>
 * ```
 * 
 * ### Drawer (Drawer תחתון)
 * **מיקום:** `components/ui/drawer.jsx`
 * **שימוש:**
 * ```jsx
 * import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
 * 
 * <Drawer>
 *   <DrawerTrigger>פתח</DrawerTrigger>
 *   <DrawerContent>
 *     <DrawerHeader>
 *       <DrawerTitle>כותרת</DrawerTitle>
 *     </DrawerHeader>
 *     <p>תוכן...</p>
 *   </DrawerContent>
 * </Drawer>
 * ```
 * 
 * ### Popover
 * **מיקום:** `components/ui/popover.jsx`
 * **שימוש:**
 * ```jsx
 * import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 * import { Button } from "@/components/ui/button";
 * 
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button variant="outline">פתח</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>
 *     <p>תוכן הפופאובר</p>
 *   </PopoverContent>
 * </Popover>
 * ```
 * 
 * ### Hover Card
 * **מיקום:** `components/ui/hover-card.jsx`
 * **שימוש:**
 * ```jsx
 * import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
 * 
 * <HoverCard>
 *   <HoverCardTrigger>רחף מעליי</HoverCardTrigger>
 *   <HoverCardContent>
 *     <p>מידע נוסף</p>
 *   </HoverCardContent>
 * </HoverCard>
 * ```
 * 
 * ### Tooltip
 * **מיקום:** `components/ui/tooltip.jsx`
 * **שימוש:**
 * ```jsx
 * import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 * import { Button } from "@/components/ui/button";
 * 
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <Button variant="outline">רחף</Button>
 *     </TooltipTrigger>
 *     <TooltipContent>
 *       <p>טיפ</p>
 *     </TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 * ```
 * 
 * ---
 * 
 * ## קבוצת 4: תצוגת תוכן
 * 
 * ### Card
 * **מיקום:** `components/ui/card.jsx`
 * **שימוש בפרויקט:**
 * ```jsx
 * import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 * 
 * <Card>
 *   <CardHeader>
 *     <CardTitle>כותרת</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <p>תוכן הכרטיס</p>
 *   </CardContent>
 * </Card>
 * 
 * // דוגמה: StatCard עוטף את Card
 * ```
 * 
 * ### Table
 * **מיקום:** `components/ui/table.jsx`
 * **שימוש:**
 * ```jsx
 * import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 * 
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
 * ### Accordion
 * **מיקום:** `components/ui/accordion.jsx`
 * **שימוש:**
 * ```jsx
 * import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
 * 
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>שאלה 1</AccordionTrigger>
 *     <AccordionContent>תשובה 1</AccordionContent>
 *   </AccordionItem>
 *   <AccordionItem value="item-2">
 *     <AccordionTrigger>שאלה 2</AccordionTrigger>
 *     <AccordionContent>תשובה 2</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 * 
 * ### Collapsible
 * **מיקום:** `components/ui/collapsible.jsx`
 * **שימוש:**
 * ```jsx
 * import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 * 
 * <Collapsible>
 *   <CollapsibleTrigger>לחץ להרחבה</CollapsibleTrigger>
 *   <CollapsibleContent>
 *     <p>תוכן מוסתר</p>
 *   </CollapsibleContent>
 * </Collapsible>
 * ```
 * 
 * ### Carousel
 * **מיקום:** `components/ui/carousel.jsx`
 * **שימוש:**
 * ```jsx
 * import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
 * 
 * <Carousel>
 *   <CarouselContent>
 *     <CarouselItem>סליד 1</CarouselItem>
 *     <CarouselItem>סליד 2</CarouselItem>
 *     <CarouselItem>סליד 3</CarouselItem>
 *   </CarouselContent>
 *   <CarouselPrevious />
 *   <CarouselNext />
 * </Carousel>
 * ```
 * 
 * ### Avatar
 * **מיקום:** `components/ui/avatar.jsx`
 * **שימוש:**
 * ```jsx
 * import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 * 
 * <Avatar>
 *   <AvatarImage src="https://..." alt="User" />
 *   <AvatarFallback>AB</AvatarFallback>
 * </Avatar>
 * ```
 * 
 * ### Badge
 * **מיקום:** `components/ui/badge.jsx`
 * **שימוש בפרויקט:**
 * ```jsx
 * import { Badge } from "@/components/ui/badge";
 * 
 * <Badge variant="default">ברירת מחדל</Badge>
 * <Badge variant="secondary">משני</Badge>
 * <Badge variant="destructive">אדום</Badge>
 * <Badge variant="outline">מסגרת</Badge>
 * 
 * // דוגמה: TaskItem משתמש ב-Badges לקטגוריות
 * ```
 * 
 * ### Separator
 * **מיקום:** `components/ui/separator.jsx`
 * **שימוש:**
 * ```jsx
 * import { Separator } from "@/components/ui/separator";
 * 
 * <div>
 *   <p>פסקה 1</p>
 *   <Separator className="my-4" />
 *   <p>פסקה 2</p>
 * </div>
 * ```
 * 
 * ### Skeleton
 * **מיקום:** `components/ui/skeleton.jsx`
 * **שימוש:**
 * ```jsx
 * import { Skeleton } from "@/components/ui/skeleton";
 * 
 * <div>
 *   <Skeleton className="h-12 w-12 rounded-full" />
 *   <Skeleton className="h-4 w-[250px]" />
 *   <Skeleton className="h-4 w-[200px]" />
 * </div>
 * ```
 * 
 * ---
 * 
 * ## קבוצת 5: עזרים ופידבקים
 * 
 * ### Alert
 * **מיקום:** `components/ui/alert.jsx`
 * **שימוש:**
 * ```jsx
 * import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
 * import { AlertCircle } from "lucide-react";
 * 
 * <Alert variant="destructive">
 *   <AlertCircle className="h-4 w-4" />
 *   <AlertTitle>שגיאה</AlertTitle>
 *   <AlertDescription>משהו השתבש</AlertDescription>
 * </Alert>
 * ```
 * 
 * ### Toast (Sonner)
 * **מיקום:** `components/ui/sonner.jsx`, `components/ui/toast.jsx`, `components/ui/use-toast.js`, `components/ui/toaster.jsx`
 * **שימוש:**
 * ```jsx
 * // שיטה 1: Sonner (מומלץ)
 * import { toast } from "sonner";
 * 
 * toast.success("פעולה הצליחה!");
 * toast.error("שגיאה!");
 * toast.info("מידע");
 * 
 * // שיטה 2: Radix Toast
 * import { useToast } from "@/components/ui/use-toast";
 * 
 * const { toast } = useToast();
 * toast({
 *   title: "כותרת",
 *   description: "תיאור"
 * });
 * ```
 * 
 * ### Progress
 * **מיקום:** `components/ui/progress.jsx`
 * **שימוש:**
 * ```jsx
 * import { Progress } from "@/components/ui/progress";
 * 
 * <Progress value={33} />
 * <Progress value={66} className="w-[60%]" />
 * ```
 * 
 * ### Scroll Area
 * **מיקום:** `components/ui/scroll-area.jsx`
 * **שימוש:**
 * ```jsx
 * import { ScrollArea } from "@/components/ui/scroll-area";
 * 
 * <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
 *   <p>תוכן ארוך שיקבל גלילה...</p>
 * </ScrollArea>
 * ```
 * 
 * ### Calendar
 * **מיקום:** `components/ui/calendar.jsx`
 * **שימוש:**
 * ```jsx
 * import { Calendar } from "@/components/ui/calendar";
 * import { useState } from "react";
 * 
 * const [date, setDate] = useState(new Date());
 * 
 * <Calendar
 *   mode="single"
 *   selected={date}
 *   onSelect={setDate}
 * />
 * ```
 * 
 * ### Chart
 * **מיקום:** `components/ui/chart.jsx`
 * **שימוש בפרויקט:**
 * ```jsx
 * import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
 * import { LineChart, Line, XAxis, YAxis } from "recharts";
 * 
 * // דוגמה: RiskZoneChart משתמש ב-recharts + chart wrapper
 * ```
 * 
 * ### Toggle / Toggle Group
 * **מיקום:** `components/ui/toggle.jsx`, `components/ui/toggle-group.jsx`
 * **שימוש:**
 * ```jsx
 * import { Toggle } from "@/components/ui/toggle";
 * import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
 * 
 * <Toggle aria-label="Toggle italic">
 *   <Bold className="h-4 w-4" />
 * </Toggle>
 * 
 * <ToggleGroup type="single">
 *   <ToggleGroupItem value="a">A</ToggleGroupItem>
 *   <ToggleGroupItem value="b">B</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 * 
 * ### Aspect Ratio
 * **מיקום:** `components/ui/aspect-ratio.jsx`
 * **שימוש:**
 * ```jsx
 * import { AspectRatio } from "@/components/ui/aspect-ratio";
 * 
 * <AspectRatio ratio={16 / 9}>
 *   <img src="..." alt="Image" className="rounded-md object-cover" />
 * </AspectRatio>
 * ```
 * 
 * ### Resizable
 * **מיקום:** `components/ui/resizable.jsx`
 * **שימוש:**
 * ```jsx
 * import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
 * 
 * <ResizablePanelGroup direction="horizontal">
 *   <ResizablePanel defaultSize={50}>
 *     <div>פאנל 1</div>
 *   </ResizablePanel>
 *   <ResizableHandle />
 *   <ResizablePanel defaultSize={50}>
 *     <div>פאנל 2</div>
 *   </ResizablePanel>
 * </ResizablePanelGroup>
 * ```
 * 
 * ### Sidebar
 * **מיקום:** `components/ui/sidebar.jsx`
 * **שימוש:**
 * ```jsx
 * import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
 * 
 * <SidebarProvider>
 *   <Sidebar>
 *     <SidebarContent>
 *       <SidebarGroup>
 *         <SidebarGroupLabel>תפריט</SidebarGroupLabel>
 *         <SidebarGroupContent>
 *           <SidebarMenu>
 *             <SidebarMenuItem>
 *               <SidebarMenuButton>פריט 1</SidebarMenuButton>
 *             </SidebarMenuItem>
 *           </SidebarMenu>
 *         </SidebarGroupContent>
 *       </SidebarGroup>
 *     </SidebarContent>
 *   </Sidebar>
 *   <main>
 *     <SidebarTrigger />
 *     תוכן ראשי
 *   </main>
 * </SidebarProvider>
 * ```
 * 
 * ---
 * 
 * ## כללי שימוש
 * 
 * ### אימפורט קומפוננטות
 * תמיד השתמש ב-alias `@/components/ui/[component]`:
 * ```jsx
 * import { Button } from "@/components/ui/button";
 * import { Card } from "@/components/ui/card";
 * ```
 * 
 * ### עבודה עם Variants
 * רוב הקומפוננטות תומכות ב-variants:
 * ```jsx
 * <Button variant="default" size="default">
 * <Alert variant="destructive">
 * <Badge variant="outline">
 * ```
 * 
 * ### שילוב עם Tailwind
 * כל הקומפוננטות מקבלות `className`:
 * ```jsx
 * <Button className="mt-4 bg-cyan-600">
 * <Card className="p-6 shadow-lg">
 * ```
 * 
 * ### נגישות (a11y)
 * shadcn/ui מבוסס על Radix UI שמטפל בנגישות:
 * - תמיכה במקלדת מלאה
 * - ARIA attributes אוטומטיים
 * - Screen reader friendly
 * 
 * ---
 * 
 * ## קומפוננטות בשימוש ב-FlowUp
 * 
 * ### Dashboard.jsx משתמש ב:
 * - `Button` - כפתורי פעולה (עדכן/מחק)
 * - `Card` (דרך StatCard) - כרטיסי מידע
 * - `Tabs` (דרך WhatIfSimulator) - מיתוג בין הוצאה/הכנסה
 * 
 * ### CSVUploader.jsx משתמש ב:
 * - `Button` - כפתור ביטול
 * - Dialog functionality (custom modal)
 * 
 * ### כללי:
 * - `lucide-react` לאייקונים בכל מקום
 * - `cn()` מ-`@/lib/utils` למיזוג classNames
 * - `framer-motion` לאנימציות
 * 
 * ---
 * 
 * **גרסה:** FlowUp v1.0.0  
 * **עדכון אחרון:** 2026-01-12
 */

export default null;