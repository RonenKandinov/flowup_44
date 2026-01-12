/**
 * FlowUp - ארכיטקטורת מערכת UI
 * ===============================
 * 
 * ## עקרונות עיצוב
 * 
 * FlowUp בנויה על שלושה עמודי תווך עיצוביים:
 * 
 * 1. **Consistency** - עקביות בכל הממשק
 * 2. **Accessibility** - נגישות מלאה לכל המשתמשים
 * 3. **Performance** - ביצועים מהירים וחלקים
 * 
 * ---
 * 
 * ## תשתית טכנולוגית
 * 
 * ### shadcn/ui Architecture
 * 
 * shadcn/ui הוא לא ספרייה אלא **collection של קומפוננטות לשיפוח**.
 * הקומפוננטות מועתקות לפרויקט ויכולות להיות מותאמות לחלוטין.
 * 
 * **שכבות:**
 * 
 * ```
 * ┌─────────────────────────────────────┐
 * │   FlowUp Components                 │
 * │   (Dashboard, SpeedometerGauge...)  │
 * └──────────────┬──────────────────────┘
 *                │
 * ┌──────────────▼──────────────────────┐
 * │   shadcn/ui Components              │
 * │   (Button, Card, Dialog...)         │
 * └──────────────┬──────────────────────┘
 *                │
 * ┌──────────────▼──────────────────────┐
 * │   Radix UI Primitives               │
 * │   (Unstyled, accessible)            │
 * └──────────────┬──────────────────────┘
 *                │
 * ┌──────────────▼──────────────────────┐
 * │   React + Tailwind CSS              │
 * └─────────────────────────────────────┘
 * ```
 * 
 * ### Radix UI - הבסיס
 * 
 * Radix UI מספק פרימיטיבים ללא סטיילינג:
 * - נגישות מובנית (ARIA, keyboard navigation)
 * - Unstyled - ניתן לעיצוב מלא
 * - Composable - בנוי ממרכיבים קטנים
 * - Type-safe עם TypeScript
 * 
 * **דוגמה:**
 * ```jsx
 * import * as Dialog from '@radix-ui/react-dialog';
 * 
 * // Radix מספק רק את הלוגיקה:
 * <Dialog.Root>
 *   <Dialog.Trigger />
 *   <Dialog.Portal>
 *     <Dialog.Overlay />
 *     <Dialog.Content />
 *   </Dialog.Portal>
 * </Dialog.Root>
 * ```
 * 
 * ### shadcn/ui - הסטיילינג
 * 
 * shadcn לוקח את Radix ומוסיף:
 * - Tailwind CSS classes
 * - Variants עם CVA (class-variance-authority)
 * - Default styling שניתן לשינוי
 * 
 * **דוגמה:**
 * ```jsx
 * // components/ui/dialog.jsx
 * const DialogContent = React.forwardRef(({ className, ...props }, ref) => (
 *   <DialogPrimitive.Content
 *     ref={ref}
 *     className={cn(
 *       "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
 *       "rounded-lg border bg-background p-6 shadow-lg",
 *       className
 *     )}
 *     {...props}
 *   />
 * ))
 * ```
 * 
 * ---
 * 
 * ## Tailwind CSS Integration
 * 
 * ### Design Tokens
 * 
 * Tailwind מוגדר ב-`tailwind.config.js` עם:
 * - CSS Variables לצבעים (תמיכת dark mode)
 * - Custom spacing scale
 * - Typography system
 * - Animation utilities
 * 
 * **דוגמה לצבעים:**
 * ```css
 * :root {
 *   --background: 0 0% 100%;
 *   --foreground: 222.2 84% 4.9%;
 *   --primary: 222.2 47.4% 11.2%;
 *   --primary-foreground: 210 40% 98%;
 *   ...
 * }
 * ```
 * 
 * ### Utility-First Approach
 * 
 * במקום CSS מותאם אישית, משתמשים ב-utility classes:
 * 
 * ```jsx
 * // ❌ לא כך:
 * <div className="custom-card">
 * 
 * // ✅ כך:
 * <div className="rounded-lg border bg-white p-6 shadow-sm">
 * ```
 * 
 * ### cn() Utility
 * 
 * פונקציה למיזוג classes ב-`lib/utils.js`:
 * ```javascript
 * import { clsx } from "clsx";
 * import { twMerge } from "tailwind-merge";
 * 
 * export function cn(...inputs) {
 *   return twMerge(clsx(inputs));
 * }
 * ```
 * 
 * **שימוש:**
 * ```jsx
 * <Button className={cn(
 *   "base-classes",
 *   variant === "destructive" && "destructive-classes",
 *   className // מאפשר override
 * )}>
 * ```
 * 
 * ---
 * 
 * ## Class Variance Authority (CVA)
 * 
 * ### מה זה CVA?
 * 
 * CVA מאפשר ניהול variants מורכבים בצורה type-safe:
 * 
 * ```javascript
 * import { cva } from "class-variance-authority";
 * 
 * const buttonVariants = cva(
 *   // Base classes (תמיד חלים)
 *   "inline-flex items-center justify-center rounded-md font-medium",
 *   {
 *     variants: {
 *       variant: {
 *         default: "bg-primary text-primary-foreground",
 *         destructive: "bg-destructive text-destructive-foreground",
 *         outline: "border border-input bg-background",
 *       },
 *       size: {
 *         default: "h-10 px-4 py-2",
 *         sm: "h-9 rounded-md px-3",
 *         lg: "h-11 rounded-md px-8",
 *       },
 *     },
 *     defaultVariants: {
 *       variant: "default",
 *       size: "default",
 *     },
 *   }
 * );
 * ```
 * 
 * **שימוש:**
 * ```jsx
 * <button className={buttonVariants({ variant: "outline", size: "lg" })}>
 * ```
 * 
 * ### Compound Variants
 * 
 * CVA תומך בשילובים של variants:
 * ```javascript
 * const variants = cva("base", {
 *   variants: { ... },
 *   compoundVariants: [
 *     {
 *       variant: "destructive",
 *       size: "lg",
 *       class: "text-xl font-bold" // חל רק כששניהם ביחד
 *     }
 *   ]
 * });
 * ```
 * 
 * ---
 * 
 * ## Component Composition Patterns
 * 
 * ### Pattern 1: Compound Components
 * 
 * קומפוננטות משויכות שעובדות יחד:
 * 
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
 * **יתרונות:**
 * - Semantic HTML structure
 * - גמישות בשימוש
 * - סטיילינג עקבי
 * 
 * ### Pattern 2: Trigger + Content
 * 
 * דפוס נפוץ בפופאפים:
 * 
 * ```jsx
 * <Dialog>
 *   <DialogTrigger>פתח</DialogTrigger>
 *   <DialogContent>תוכן</DialogContent>
 * </Dialog>
 * ```
 * 
 * ### Pattern 3: Provider Pattern
 * 
 * Context לשיתוף state:
 * 
 * ```jsx
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger>...</TooltipTrigger>
 *     <TooltipContent>...</TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 * ```
 * 
 * ### Pattern 4: Polymorphic Components
 * 
 * קומפוננטות שיכולות לרנדר כאלמנטים שונים:
 * 
 * ```jsx
 * <Button asChild>
 *   <Link to="/page">לינק</Link>
 * </Button>
 * 
 * // מרנדר: <a href="/page" class="button-classes">לינק</a>
 * ```
 * 
 * ---
 * 
 * ## Styling Best Practices
 * 
 * ### 1. Component Isolation
 * 
 * כל קומפוננטה אחראית לסטיילינג שלה:
 * ```jsx
 * // ✅ טוב
 * <StatCard className="mt-4">
 * 
 * // ❌ רע - סטיילינג של ילד מהאב
 * <div className="[&_.stat-card]:mt-4">
 *   <StatCard />
 * </div>
 * ```
 * 
 * ### 2. Responsive Design
 * 
 * השתמש ב-Tailwind responsive modifiers:
 * ```jsx
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
 * <Button className="text-sm md:text-base lg:text-lg">
 * ```
 * 
 * ### 3. Dark Mode Support
 * 
 * (לא בשימוש כרגע ב-FlowUp, אבל מוכן):
 * ```jsx
 * <div className="bg-white dark:bg-slate-950">
 * ```
 * 
 * ### 4. Animation Strategy
 * 
 * שילוב של Tailwind + Framer Motion:
 * 
 * ```jsx
 * // Tailwind - transitions פשוטים
 * <button className="transition-colors hover:bg-slate-100">
 * 
 * // Framer Motion - אנימציות מורכבות
 * <motion.div
 *   initial={{ opacity: 0, y: 20 }}
 *   animate={{ opacity: 1, y: 0 }}
 *   transition={{ duration: 0.3 }}
 * >
 * ```
 * 
 * ---
 * 
 * ## Accessibility (a11y) Guidelines
 * 
 * ### Keyboard Navigation
 * 
 * Radix UI מטפל אוטומטית ב:
 * - Tab navigation
 * - Arrow keys (במנוים)
 * - Escape key (לסגירת מודאלים)
 * - Space/Enter (להפעלה)
 * 
 * ### ARIA Attributes
 * 
 * מוסף אוטומטית:
 * ```html
 * <button aria-expanded="true" aria-haspopup="dialog">
 * <div role="dialog" aria-labelledby="title">
 * ```
 * 
 * ### Focus Management
 * 
 * - Focus trap במודאלים
 * - Focus return כשסוגרים
 * - Visible focus indicators
 * 
 * ### Screen Readers
 * 
 * ```jsx
 * // VisuallyHidden לטקסט screen reader בלבד
 * <VisuallyHidden>נוסף לסל</VisuallyHidden>
 * 
 * // aria-label לאייקונים
 * <button aria-label="סגור">
 *   <X className="h-4 w-4" />
 * </button>
 * ```
 * 
 * ---
 * 
 * ## Performance Optimizations
 * 
 * ### 1. Tree Shaking
 * 
 * shadcn מאפשר ייבוא רק של מה שצריך:
 * ```jsx
 * // ✅ רק Dialog ייטען
 * import { Dialog } from "@/components/ui/dialog";
 * 
 * // ❌ כל shadcn ייטען
 * import * as UI from "@/components/ui";
 * ```
 * 
 * ### 2. Code Splitting
 * 
 * קומפוננטות כבדות נטענות רק כשצריך:
 * ```jsx
 * const HeavyChart = lazy(() => import('./HeavyChart'));
 * 
 * <Suspense fallback={<Skeleton />}>
 *   <HeavyChart />
 * </Suspense>
 * ```
 * 
 * ### 3. Memoization
 * 
 * ```jsx
 * const MemoizedStatCard = memo(StatCard);
 * 
 * // או:
 * const expensiveValue = useMemo(() => 
 *   calculateComplexData(data),
 *   [data]
 * );
 * ```
 * 
 * ### 4. CSS Optimization
 * 
 * Tailwind מייצר רק את ה-classes בשימוש:
 * - Purge unused CSS
 * - Minified production build
 * - Gzip compression
 * 
 * ---
 * 
 * ## Theming System
 * 
 * ### CSS Variables
 * 
 * FlowUp משתמש ב-CSS variables לצבעים:
 * 
 * ```css
 * /* globals.css */
 * :root {
 *   --background: 0 0% 100%;
 *   --foreground: 222.2 84% 4.9%;
 *   --card: 0 0% 100%;
 *   --card-foreground: 222.2 84% 4.9%;
 *   --primary: 222.2 47.4% 11.2%;
 *   --primary-foreground: 210 40% 98%;
 *   --secondary: 210 40% 96.1%;
 *   --secondary-foreground: 222.2 47.4% 11.2%;
 *   --muted: 210 40% 96.1%;
 *   --muted-foreground: 215.4 16.3% 46.9%;
 *   --accent: 210 40% 96.1%;
 *   --accent-foreground: 222.2 47.4% 11.2%;
 *   --destructive: 0 84.2% 60.2%;
 *   --destructive-foreground: 210 40% 98%;
 *   --border: 214.3 31.8% 91.4%;
 *   --input: 214.3 31.8% 91.4%;
 *   --ring: 222.2 84% 4.9%;
 *   --radius: 0.5rem;
 * }
 * ```
 * 
 * ### תמיכת RTL
 * 
 * FlowUp נכתב בעברית ותומך ב-RTL:
 * 
 * ```html
 * <html dir="rtl" lang="he">
 * ```
 * 
 * Tailwind מטפל אוטומטית ב:
 * - `ml-4` → margin-right
 * - `text-left` → text-right
 * - Flexbox direction
 * 
 * ---
 * 
 * ## Component Testing Strategy
 * 
 * ### Unit Tests
 * 
 * בדיקת לוגיקה של קומפוננטה:
 * ```jsx
 * test('Button renders with correct variant', () => {
 *   render(<Button variant="destructive">מחק</Button>);
 *   expect(screen.getByRole('button')).toHaveClass('bg-destructive');
 * });
 * ```
 * 
 * ### Accessibility Tests
 * 
 * בדיקת נגישות:
 * ```jsx
 * test('Dialog has proper ARIA attributes', () => {
 *   render(<Dialog open><DialogContent>...</DialogContent></Dialog>);
 *   expect(screen.getByRole('dialog')).toBeInTheDocument();
 * });
 * ```
 * 
 * ### Visual Regression
 * 
 * בדיקה שהעיצוב לא השתנה בטעות (Storybook/Chromatic).
 * 
 * ---
 * 
 * ## הוספת קומפוננטה חדשה
 * 
 * ### שלבים:
 * 
 * 1. **התקנה:** (לא נדרש - כל shadcn כבר מותקן)
 * 
 * 2. **יצירת הקומפוננטה:**
 * ```bash
 * # אם היית צריך להוסיף קומפוננטה חדשה:
 * npx shadcn-ui@latest add [component-name]
 * ```
 * 
 * 3. **התאמה אישית:**
 * ערוך את `components/ui/[component].jsx` לפי צורך.
 * 
 * 4. **שימוש:**
 * ```jsx
 * import { NewComponent } from "@/components/ui/new-component";
 * 
 * <NewComponent variant="custom" />
 * ```
 * 
 * 5. **תיעוד:**
 * הוסף את הקומפוננטה למדריך זה.
 * 
 * ---
 * 
 * ## הרחבות ייחודיות ל-FlowUp
 * 
 * ### Custom Components
 * 
 * FlowUp יצר קומפוננטות מותאמות שמשתמשות ב-shadcn כבסיס:
 * 
 * **StatCard:**
 * - עוטף את `Card`
 * - מוסיף variants לצבעים (cyan, green, red)
 * - אנימציות עם framer-motion
 * 
 * **SpeedometerGauge:**
 * - קומפוננטה חדשה לחלוטין
 * - SVG עם אנימציות
 * - מד מסוג speedometer למצב פיננסי
 * 
 * **WhatIfSimulator:**
 * - משתמש ב-`Tabs` מ-shadcn
 * - לוגיקה מותאמת לחישובי תזרים
 * 
 * ### Design System Extensions
 * 
 * צבעים נוספים ב-Tailwind:
 * ```javascript
 * // tailwind.config.js
 * theme: {
 *   extend: {
 *     colors: {
 *       cyan: { ... },
 *       risk: {
 *         green: '#22c55e',
 *         yellow: '#eab308',
 *         red: '#ef4444'
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * ---
 * 
 * ## מסקנות
 * 
 * ### מתי להשתמש בקומפוננטות מוכנות?
 * 
 * ✅ **כן:**
 * - טפסים ואינפוטים סטנדרטיים
 * - מודאלים ודיאלוגים
 * - תפריטים וניווט
 * - כרטיסים ולאאוטים
 * 
 * ❌ **לא:**
 * - ויזואליזציות ייחודיות (כמו SpeedometerGauge)
 * - גרפים מורכבים (השתמש ב-recharts ישירות)
 * - אינטראקציות מיוחדות (צור custom)
 * 
 * ### עקרונות מנחים
 * 
 * 1. **העדף קומפוזיציה על ירושה**
 * 2. **שמור על עקביות עיצובית**
 * 3. **אל תחזור על עצמך (DRY)**
 * 4. **נגישות תמיד במקום ראשון**
 * 5. **ביצועים חשובים**
 * 
 * ---
 * 
 * **גרסה:** FlowUp v1.0.0  
 * **עדכון אחרון:** 2026-01-12  
 * **מערכת UI:** shadcn/ui + Radix UI + Tailwind CSS
 */

export default null;