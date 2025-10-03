import { useState, useEffect, useCallback, useMemo } from "react";
import { Form, useNavigation, useNavigate, useActionData, useLoaderData } from "@remix-run/react";
import { Page, Card, TextField, Button, InlineStack, Text, BlockStack, RadioButton, Collapsible, Select, Banner } from "@shopify/polaris";
import { ProductPicker } from "../components/ProductPicker/ProductPicker";
import { createAutomaticDiscount } from "../models/discounts.server";
import { createDiscountSetting, createWidgetSettings } from "../models/db.prisma";
import { authenticate } from "../shopify.server";
import { LoaderFunctionArgs, ActionFunctionArgs, redirect, json } from "@remix-run/node";
import { ChevronDownIcon, ChevronUpIcon, DeleteIcon, PlusIcon, DragHandleIcon, ArrowLeftIcon } from "@shopify/polaris-icons";
import { CollectionPicker } from "../components/CollectionPicker/CollectionPicker";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const functionId = params.functionId || process.env.DISCOUNT_FUNCTION_ID || "";

  return json({ functionId });
};

interface MetafieldInput {
  namespace: string;
  key: string;
  type: "string" | "boolean" | "json" | "integer";
  value: string; // JSON string when type === "json"
}

interface AutomaticAppDiscountInput {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  functionId: string;
  combinesWith: {
    productDiscounts: boolean;
    shippingDiscounts: boolean;
    orderDiscounts: boolean;
  };
  discountClasses: unknown;
  metafields: MetafieldInput[];
}

interface DiscountPayload {
  bundleName: string;
  discountName: string;
  productIds: string[];
  collectionIds: string[];
  visibility: string;
  discountLogic: unknown; // object persisted in DB (parsed JSON)
  startDate: string; // ISO
  endDate?: string | null; // ISO or null
  metafieldValue: string; // stringified JSON used for Shopify metafield
  widgetSettings: {
    title: string;
    settings: Record<string, unknown>;
  };
}

async function buildAutomaticDiscountVariables(discount: DiscountPayload, functionId: string): Promise<AutomaticAppDiscountInput> {
  return {
    title: discount.discountName,
    startsAt: new Date(discount.startDate).toISOString(),
    endsAt: discount.endDate ? new Date(discount.endDate).toISOString() : null,
    functionId,
    combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: false },
    discountClasses: ["PRODUCT"],
    metafields: [
      {
        namespace: "default",
        key: "function-configuration",
        type: "json",
        value: discount.metafieldValue,
      },
    ],
  };
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const discountRaw = formData.get("discount");
  // return discountRaw;
  if (!discountRaw || typeof discountRaw !== "string") throw new Error("No discount data provided");

  let discount: DiscountPayload;
  try {
    discount = JSON.parse(discountRaw) as DiscountPayload;
  } catch {
    throw new Error("Invalid JSON payload");
  }
  // return discount;
  // Defaults
  if (!discount.bundleName) discount.bundleName = discount.discountName || "Default Bundle";
  if (!discount.startDate) discount.startDate = new Date().toISOString();

  const functionId = params.functionId || process.env.DISCOUNT_FUNCTION_ID || "";
  if (!functionId) {
    return json<ActionData>({ success: false, errors: [{ field: ["automaticAppDiscount", "functionId"], message: "Function id can't be blank." }] as any }, { status: 400 });
  }

  // Create Shopify discount first; only persist DB if successful
  const discountApiPayload = await buildAutomaticDiscountVariables(discount, functionId);
  const { data: createdShopifyDiscount, errors } = await createAutomaticDiscount(request, discountApiPayload);
  if (errors && errors.length > 0) {
    return json<ActionData>({ success: false, errors: errors as any }, { status: 400 });
  }
  if (!createdShopifyDiscount?.discountId) {
    return json<ActionData>({ success: false, errors: [{ field: [], message: "Failed to create discount in Shopify" }] as any }, { status: 400 });
  }

  // Persist discount settings (one row per productId if provided)
  // STEP 1: Create Widget first
  const widget = await createWidgetSettings({
    shop: session.shop,
    title: discount.widgetSettings?.title || discount.bundleName,
    status: true,
    settings: discount.widgetSettings?.settings || {},
  });

  const createdDiscountRows = await createDiscountSetting({
    widgetId: widget.id,
    bundleName: discount.bundleName,
    discountName: discount.discountName,
    visibility: discount.visibility,
    productIds: discount.productIds || [],
    collectionIds : discount.collectionIds || [],
    discountLogic: discount.discountLogic ?? {},
    startDate: new Date(discount.startDate),
    endDate: discount.endDate ? new Date(discount.endDate) : undefined,
  });
  // Redirect to app home on success
  return redirect("/app");
};

interface ActionData {
  errors?: {
    code?: string;
    message: string;
    field: string[];
  }[];
  success?: boolean;
}

// Update the DiscountBar interface to make image optional and add product selection
interface DiscountBar {
  id: string;
  barTitle: string;
  title: string;
  description: string;
  badge: string;
  quantity: number;
  priceType: 'percentage' | 'amount_off' | 'exact_price';
  priceValue: number;
  gift?: {
    text: string;
    imageUrl?: string; // Optional
    imageSize: number;
    giftVariantId?: string;
    giftVariantTitle?: string;
    quantity?: number; // Free gift quantity
  };
}

export default function VolumeNew() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isLoading = navigation.state === "submitting";
  const submitErrors = actionData?.errors || [];
  const [styleOpen, setStyleOpen] = useState(true);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [name, setName] = useState<string>("Bundle 1");
  const [discountTitle, setDiscountTitle] = useState<string>("");
  const [blockTitle, setBlockTitle] = useState<string>("End of Sale");

  // Replace packSelection with dynamic bars
  const [discountBars, setDiscountBars] = useState<DiscountBar[]>([
    {
      id: 'bar-1',
      barTitle: 'Bar 1',
      title: '1 Pack',
      description: 'You save 10%', // This will be dynamic based on priceType
      badge: 'SAVE £2.25', // 22.50 * 1 * 0.10 = £2.25
      quantity: 1,
      priceType: 'percentage',
      priceValue: 10
    },
    {
      id: 'bar-2',
      barTitle: 'Bar 2',
      title: '2 Pack',
      description: 'You save £5.00', // This will be dynamic based on priceType
      badge: 'SAVE £5.00', // Direct amount off
      quantity: 2,
      priceType: 'amount_off',
      priceValue: 5
    }
  ]);
  const [selectedBarId, setSelectedBarId] = useState<string>('bar-1');

  // Add state for tracking which bars are open/closed
  const [openBars, setOpenBars] = useState<Set<string>>(new Set());

  // Add drag and drop state
  const [draggedBarId, setDraggedBarId] = useState<string | null>(null);

  // Add state for managing gift settings
  const [giftOpenBars, setGiftOpenBars] = useState<Set<string>>(new Set());

  // if (actionData?.success) {
  //   returnToDiscounts();
  // }

  const initialData = {
    title: name,
    // method: "DiscountMethod.Automatic,"
    code: "",
    combinesWith: {
      orderDiscounts: true,
      productDiscounts: true,
      shippingDiscounts: false,
    },
    // discountClasses: [DiscountClass.Product],
    usageLimit: null,
    appliesOncePerCustomer: false,
    startsAt: new Date(),
    endsAt: null,
    configuration: {
      cartLinePercentage: "0",
      orderPercentage: "0",
      deliveryPercentage: "0",
      collectionIds: [],
    },
  };

  const [visibility, setVisibility] = useState('ALL_PRODUCTS');

  const handleVisibilityChange = useCallback(
    (_: boolean, newValue: string) => setVisibility(newValue),
    [],
  );

  // Resource selection state
  const [selectedProducts, setSelectedProducts] = useState<{ id: string; title: string }[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<{ id: string; title: string }[]>([]);

  // Typography & Colors state (existing)
  const [titleFontSize, setTitleFontSize] = useState<string>('16');
  const [titleColor, setTitleColor] = useState<string>('#111213');
  const [titleWeight, setTitleWeight] = useState<string>('600');
  const [optionHeadingSize, setOptionHeadingSize] = useState<string>('14');
  const [optionDescSize, setOptionDescSize] = useState<string>('12');
  const [optionHeadingWeight, setOptionHeadingWeight] = useState<string>('700');
  const [optionDescWeight, setOptionDescWeight] = useState<string>('400');
  const [labelSize, setLabelSize] = useState<string>('12');
  const [labelWeight, setLabelWeight] = useState<string>('400');

  const [cardsBg, setCardsBg] = useState<string>('#FFFFFF');
  const [selectedBg, setSelectedBg] = useState<string>('#EEF3FF');
  const [borderColor, setBorderColor] = useState<string>('#E1E3E5');
  const [blockTitleColor, setBlockTitleColor] = useState<string>('#111213');
  const [barTitleColor, setBarTitleColor] = useState<string>('#111213');
  const [barSubtitleColor, setBarSubtitleColor] = useState<string>('#5C5F62');
  const [priceColor, setPriceColor] = useState<string>('#111213');
  const [fullPriceColor, setFullPriceColor] = useState<string>('#5C5F62');
  const [labelBg, setLabelBg] = useState<string>('#D9D9D9');
  const [labelText, setLabelText] = useState<string>('#111213');

  // Add gift typography and color state (moved up before widgetSettingsJson use)
  const [giftTextSize, setGiftTextSize] = useState<string>('12');
  const [giftTextWeight, setGiftTextWeight] = useState<string>('400');
  const [giftTextColor, setGiftTextColor] = useState<string>('#111213');
  const [giftBg, setGiftBg] = useState<string>('#F8F9FA');
  const [giftBorderColor, setGiftBorderColor] = useState<string>('#E1E3E5');

  // Build metafield payload from visibility + bars
  const metafieldOverride = useMemo(() => {
    const scope = (() => {
      if (visibility === 'ALL_PRODUCTS') return { all: true };
      if (visibility === 'SPECIFIC_PRODUCTS') return { productIds: selectedProducts.map(p => p.id) };
      if (visibility === 'SPECIFIC_COLLECTIONS') return { collectionIds: selectedCollections.map(c => c.id) };
      if (visibility === 'ALL_PRODUCTS_NOT_SOME') return { all: true, excludeProductIds: selectedProducts.map(p => p.id) };
      return {};
    })();

    const tiers = discountBars.map(bar => ({
      quantity: bar.quantity,
      priceType: bar.priceType,
      priceValue: bar.priceValue,
      ...(bar.gift?.giftVariantId ? { giftVariantId: bar.gift.giftVariantId } : {}),
      ...(bar.gift?.quantity ? { giftQuantity: bar.gift.quantity } : {}),
    }));

    return JSON.stringify({ scope, tiers });
  }, [visibility, selectedProducts, selectedCollections, discountBars]);

  // Compute widget settings JSON (colors, typography, etc.)
  const widgetSettingsJson = useMemo(() => {
    return {
      colors: {
        cardsBg, selectedBg, borderColor, blockTitleColor, barTitleColor, barSubtitleColor, priceColor, fullPriceColor, labelBg, labelText,
      },
      typography: {
        titleFontSize, titleWeight, optionHeadingSize, optionDescSize, optionHeadingWeight, optionDescWeight, labelSize, labelWeight,
      },
      gift: {
        textSize: giftTextSize, textWeight: giftTextWeight, textColor: giftTextColor, bg: giftBg, borderColor: giftBorderColor,
      },
      block: { title: blockTitle },
      bars: discountBars.map(b => ({ id: b.id, barTitle: b.barTitle, title: b.title, description: b.description, badge: b.badge, quantity: b.quantity, priceType: b.priceType, priceValue: b.priceValue, gift: b.gift || null })),
    } as const;
  }, [cardsBg, selectedBg, borderColor, blockTitleColor, barTitleColor, barSubtitleColor, priceColor, fullPriceColor, labelBg, labelText, titleFontSize, titleWeight, optionHeadingSize, optionDescSize, optionHeadingWeight, optionDescWeight, labelSize, labelWeight, giftTextSize, giftTextWeight, giftTextColor, giftBg, giftBorderColor, blockTitle, discountBars]);

  // Prepare discount payload for submission
  const discountFormJson = useMemo(() => {
    const productIds = visibility === 'SPECIFIC_PRODUCTS' || visibility === 'ALL_PRODUCTS_NOT_SOME'
      ? selectedProducts.map(p => p.id)
      : [];

    const collectionIds = visibility === "SPECIFIC_COLLECTIONS" ? selectedCollections.map(c => c.id) : [];

    const payload: DiscountPayload = {
      bundleName: name,
      discountName: discountTitle || name,
      productIds,
      collectionIds,
      visibility,
      discountLogic: (() => { try { return JSON.parse(metafieldOverride); } catch { return {}; } })(),
      startDate: new Date().toISOString(),
      endDate: null,
      metafieldValue: metafieldOverride,
      widgetSettings: {
        title: blockTitle,
        settings: widgetSettingsJson,
      },
    };

    return JSON.stringify(payload);
  }, [name, discountTitle, visibility, selectedProducts, metafieldOverride, blockTitle, widgetSettingsJson]);

  // Add/remove bar functions
  const addBar = useCallback(() => {
    const newId = `bar-${Date.now()}`;
    const newBar: DiscountBar = {
      id: newId,
      barTitle: `Bar ${discountBars.length + 1}`,
      title: `${discountBars.length + 1} Pack`,
      description: 'You save 10%', // Default description
      badge: 'SAVE £2.25', // Default badge
      quantity: discountBars.length + 1,
      priceType: 'percentage',
      priceValue: 10,
    };
    setDiscountBars(prev => [...prev, newBar]);
  }, [discountBars.length]);

  // Update the addBar function to add below a specific bar
  const addBarBelow = useCallback((afterBarId: string) => {
    const newId = `bar-${Date.now()}`;
    const newBar: DiscountBar = {
      id: newId,
      barTitle: `Bar ${discountBars.length + 1}`,
      title: `${discountBars.length + 1} Pack`,
      description: 'You save 10%',
      badge: 'SAVE £2.25',
      quantity: discountBars.length + 1,
      priceType: 'percentage',
      priceValue: 10
    };

    setDiscountBars(prev => {
      const index = prev.findIndex(bar => bar.id === afterBarId);
      if (index === -1) return [...prev, newBar];
      return [...prev.slice(0, index + 1), newBar, ...prev.slice(index + 1)];
    });

    // Update the name to the next bundle number
    setName(`Bundle ${discountBars.length + 1}`);

    // Open the new bar
    setOpenBars(prev => new Set([...prev, newId]));
  }, [discountBars.length]);

  // Toggle bar open/closed
  const toggleBar = useCallback((barId: string) => {
    setOpenBars(prev => {
      const newSet = new Set(prev);
      if (newSet.has(barId)) {
        newSet.delete(barId);
      } else {
        newSet.add(barId);
      }
      return newSet;
    });
  }, []);

  const removeBar = useCallback((barId: string) => {
    setDiscountBars(prev => {
      const newBars = prev.filter(bar => bar.id !== barId);
      // If we removed the selected bar, select the first remaining one
      if (selectedBarId === barId && newBars.length > 0) {
        setSelectedBarId(newBars[0].id);
      }

      // Update name to reflect the current number of bars
      if (newBars.length > 0) {
        setName(`Bundle ${newBars.length}`);
      } else {
        setName("Bundle 1");
      }

      return newBars;
    });
  }, [selectedBarId]);

  const updateBar = useCallback((barId: string, field: keyof DiscountBar, value: string | number) => {
    setDiscountBars(prev => prev.map(bar =>
      bar.id === barId ? { ...bar, [field]: value } : bar
    ));
  }, []);

  // Add a function to generate dynamic description:
  const getDynamicDescription = (priceType: string, priceValue: number) => {
    if (priceType === 'percentage') {
      return `You save ${priceValue}%`;
    } else if (priceType === 'amount_off') {
      return `You save £${priceValue.toFixed(2)}`;
    } else {
      return `Price: £${priceValue.toFixed(2)}`;
    }
  };

  // Add a function to generate dynamic badge text:
  const getDynamicBadge = (priceType: string, priceValue: number, quantity: number) => {
    const basePrice = 22.50;
    const totalComparePrice = basePrice * quantity;

    if (priceType === 'percentage') {
      const savings = totalComparePrice * (priceValue / 100);
      return `SAVE £${savings.toFixed(2)}`;
    } else if (priceType === 'amount_off') {
      return `SAVE £${priceValue.toFixed(2)}`;
    } else {
      const savings = totalComparePrice - (priceValue * quantity);
      return `SAVE £${Math.max(0, savings).toFixed(2)}`;
    }
  };

  // Add drag and drop functions
  const handleDragStart = useCallback((e: React.DragEvent, barId: string) => {
    setDraggedBarId(barId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetBarId: string) => {
    e.preventDefault();

    if (!draggedBarId || draggedBarId === targetBarId) {
      setDraggedBarId(null);
      return;
    }

    setDiscountBars(prev => {
      const draggedIndex = prev.findIndex(bar => bar.id === draggedBarId);
      const targetIndex = prev.findIndex(bar => bar.id === targetBarId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newBars = [...prev];
      const [draggedBar] = newBars.splice(draggedIndex, 1);
      newBars.splice(targetIndex, 0, draggedBar);

      return newBars;
    });

    setDraggedBarId(null);
  }, [draggedBarId]);

  const handleDragEnd = useCallback(() => {
    setDraggedBarId(null);
  }, []);

  // Add gift management functions
  const toggleGift = useCallback((barId: string) => {
    setGiftOpenBars(prev => {
      const newSet = new Set(prev);
      if (newSet.has(barId)) {
        newSet.delete(barId);
      } else {
        newSet.add(barId);
      }
      return newSet;
    });
  }, []);

  // Update addGift function to include product selection
  const addGift = useCallback((barId: string) => {
    setDiscountBars(prev => prev.map(bar =>
      bar.id === barId
        ? {
          ...bar,
          gift: {
            text: '+ Free Gift',
            imageSize: 50,
            giftVariantId: '',
            giftVariantTitle: '',
            imageUrl: undefined,
            quantity: 1,
          }
        }
        : bar
    ));
    setGiftOpenBars(prev => new Set([...prev, barId]));
  }, []);

  // Add function to handle product selection for gifts
  const handleGiftProductSelect = useCallback((barId: string, selectedProducts: { id: string; title: string; imageUrl?: string }[]) => {
    if (selectedProducts.length > 0) {
      const variant = selectedProducts[0];
      setDiscountBars(prev => prev.map(bar =>
        bar.id === barId && bar.gift
          ? {
            ...bar,
            gift: {
              ...bar.gift,
              giftVariantId: variant.id,
              giftVariantTitle: variant.title,
              imageUrl: variant.imageUrl,
              text: `+ Free ${variant.title}`
            }
          }
          : bar
      ));
    } else {
      setDiscountBars(prev => prev.map(bar =>
        bar.id === barId && bar.gift
          ? {
            ...bar,
            gift: {
              ...bar.gift,
              giftVariantId: '',
              giftVariantTitle: '',
              imageUrl: undefined,
            }
          }
          : bar
      ));
    }
  }, []);

  const removeGift = useCallback((barId: string) => {
    setDiscountBars(prev => prev.map(bar =>
      bar.id === barId
        ? { ...bar, gift: undefined }
        : bar
    ));
    setGiftOpenBars(prev => {
      const newSet = new Set(prev);
      newSet.delete(barId);
      return newSet;
    });
  }, []);

  // Update updateGift function to handle number for imageSize
  const updateGift = useCallback((barId: string, field: keyof NonNullable<DiscountBar['gift']>, value: string | number) => {
    setDiscountBars(prev => prev.map(bar =>
      bar.id === barId && bar.gift
        ? { ...bar, gift: { ...bar.gift, [field]: value } }
        : bar
    ));
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/app');
  }, [navigate]);

  // Handle save
  const handleSave = useCallback(() => {
    // Get the form and trigger submission
    const form = document.getElementById('discount-form') as HTMLFormElement;
    if (form) {
      // Create a submit event and dispatch it
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    }
  }, []);

  // Handle discard
  const handleDiscard = useCallback(() => {
    if (confirm('Are you sure you want to discard your changes?')) {
      navigate('/app');
    }
  }, [navigate]);

  return (
    <Page>
      {submitErrors.length > 0 && (
        <div style={{ margin: '12px 16px' }}>
          <Banner tone="critical" title="Failed to create discount">
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {submitErrors.map((e, idx) => (
                <li key={idx}><Text as="span" variant="bodySm">{e.message}</Text></li>
              ))}
            </ul>
          </Banner>
        </div>
      )}
      {/* Custom header with back button and save/discard */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '0 16px'
      }}>
        {/* Left side - Back button and title */}
        <InlineStack gap="300" blockAlign="center">
          <Button
            icon={ArrowLeftIcon}
            onClick={handleBack}
            size="slim"
            accessibilityLabel="Go back"
          />
          <Text as="h1" variant="headingLg">Create Discount Bundle</Text>
        </InlineStack>

        {/* Right side - Save and Discard buttons */}
        <InlineStack gap="200">
          <Button
            onClick={handleDiscard}
            size="slim"
            tone="critical"
            disabled={isLoading}
          >
            Discard
          </Button>
          <Button
            onClick={handleSave}
            size="slim"
            variant="primary"
            loading={isLoading}
            disabled={isLoading}
          >
            Save Bundle
          </Button>
        </InlineStack>
      </div>

      <style>{`
        #leftColumn { scrollbar-width: none; -ms-overflow-style: none; }
        #leftColumn::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
        {/* LEFT: scrollable */}
        <Form method="post" id="discount-form" style={{ width: '50%' }}>
          <input type="hidden" name="discount" value={discountFormJson} readOnly />
          <div
            id="leftColumn"
            style={{
              overflowY: 'auto',
              paddingRight: '8px',
            }}
          >
            {/* Style & Settings (initially open) */}
            <Card>
              <div style={{ paddingBottom: '20px' }}>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Style & Settings</Text>
                  </BlockStack>
                  <Button
                    icon={styleOpen ? ChevronUpIcon : ChevronDownIcon}
                    accessibilityLabel={styleOpen ? "Collapse style & settings" : "Expand style & settings"}
                    onClick={() => setStyleOpen((v) => !v)}
                  />
                </InlineStack>
              </div>
              <Collapsible open={styleOpen} id="style-settings">
                {/* 1. Name and Block Title */}
                <div style={{ marginTop: 5 }}>
                  <TextField
                    label="Name(only for you)"
                    value={name}
                    onChange={(value: string) => setName(value)}
                    autoComplete="off"
                  />
                </div>
                <div style={{ marginTop: 5 }}>
                  <TextField
                    label="Discount Title (shown in checkout)"
                    value={discountTitle}
                    onChange={(value: string) => setDiscountTitle(value)}
                    autoComplete="off"
                  />
                </div>
                <div style={{ marginTop: 5 }}>
                  <TextField
                    label="Block Title"
                    value={blockTitle}
                    onChange={(value: string) => setBlockTitle(value)}
                    autoComplete="off"
                  />
                </div>

                {/* 2. Visibility Settings */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ paddingBottom: "5px" }}>
                    <Text as="p" variant="bodyMd">Visibility</Text>
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <BlockStack>
                      <div>
                        <RadioButton
                          label="All Products"
                          checked={visibility === 'ALL_PRODUCTS'}
                          id="ALL_PRODUCTS"
                          name="visibility"
                          onChange={handleVisibilityChange}
                        />
                      </div>
                      <div>
                        <RadioButton
                          label="All products except selected"
                          id="ALL_PRODUCTS_NOT_SOME"
                          name="visibility"
                          checked={visibility === 'ALL_PRODUCTS_NOT_SOME'}
                          onChange={handleVisibilityChange}
                        />
                        {visibility === 'ALL_PRODUCTS_NOT_SOME' ? (
                          <div style={{ marginTop: 8, marginLeft: 28 }}>
                            <div style={{ marginTop: 6 }}>
                              <ProductPicker
                                onSelect={setSelectedProducts}
                                selectedIds={selectedProducts.map((p) => p.id)}
                                items={selectedProducts}
                                type="product"
                                buttonText="Select excluded products"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <RadioButton
                          label="Specific selected products"
                          id="SPECIFIC_PRODUCTS"
                          name="visibility"
                          checked={visibility === 'SPECIFIC_PRODUCTS'}
                          onChange={handleVisibilityChange}
                        />
                        {visibility === 'SPECIFIC_PRODUCTS' ? (
                          <div style={{ marginTop: 8, marginLeft: 28 }}>
                            {/* <Text as="p" variant="bodyMd">Select products</Text> */}
                            <div style={{ marginTop: 6 }}>
                              <ProductPicker
                                onSelect={setSelectedProducts}
                                selectedIds={selectedProducts.map((p) => p.id)}
                                items={selectedProducts}
                                type="product"
                                buttonText="Select products"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <RadioButton
                          label="Products in selected collections"
                          id="SPECIFIC_COLLECTIONS"
                          name="visibility"
                          checked={visibility === 'SPECIFIC_COLLECTIONS'}
                          onChange={handleVisibilityChange}
                        />
                        {visibility === 'SPECIFIC_COLLECTIONS' ? (
                          <div style={{ marginTop: 8, marginLeft: 28 }}>
                            {/* <Text as="p" variant="bodyMd">Select collections</Text> */}
                            <div style={{ marginTop: 6 }}>
                              <CollectionPicker
                                onSelect={setSelectedCollections}
                                selectedCollectionIds={selectedCollections.map((c) => c.id)}
                                collections={selectedCollections}
                                buttonText="Select collections"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </BlockStack>
                  </div>
                </div>

                {/* 3. Typography controls */}
                <div style={{ marginTop: 12 }}>
                  <Text as="h3" variant="headingMd">Typography</Text>
                  {/* Row 1: Block title + Title */}
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">
                      <BlockStack>
                        <Text as="h4" variant="headingSm">Block title</Text>
                        <InlineStack gap="200">
                          <TextField label="Font Size" value={titleFontSize} onChange={(v: string) => setTitleFontSize(v)} autoComplete="off" type="number" />
                          <Select label="Font weight" options={[{ label: 'Regular (400)', value: '400' }, { label: 'Bold (700)', value: '700' }]} value={titleWeight} onChange={(v) => setTitleWeight(v)} />
                        </InlineStack>
                      </BlockStack>
                      <BlockStack>
                        <Text as="h4" variant="headingSm">Title</Text>
                        <InlineStack gap="200">
                          <TextField label="Font Size" value={optionHeadingSize} onChange={(v: string) => setOptionHeadingSize(v)} autoComplete="off" type="number" />
                          <Select label="Font weight" options={[{ label: 'Regular (400)', value: '400' }, { label: 'Bold (700)', value: '700' }]} value={optionHeadingWeight} onChange={(v) => setOptionHeadingWeight(v)} />
                        </InlineStack>
                      </BlockStack>
                    </InlineStack>
                  </div>
                  {/* Row 2: Subtitle + Label */}
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">
                      <BlockStack>
                        <Text as="h4" variant="headingSm">Subtitle</Text>
                        <InlineStack gap="200">
                          <TextField label="Font Size" value={optionDescSize} onChange={(v: string) => setOptionDescSize(v)} autoComplete="off" type="number" />
                          <Select label="Font weight" options={[{ label: 'Regular (400)', value: '400' }, { label: 'Bold (700)', value: '700' }]} value={optionDescWeight} onChange={(v) => setOptionDescWeight(v)} />
                        </InlineStack>
                      </BlockStack>
                      <BlockStack>
                        <Text as="h4" variant="headingSm">Label</Text>
                        <InlineStack gap="200">
                          <TextField label="Font Size" value={labelSize} onChange={(v: string) => setLabelSize(v)} autoComplete="off" type="number" />
                          <Select label="Font weight" options={[{ label: 'Regular (400)', value: '400' }, { label: 'Bold (700)', value: '700' }]} value={labelWeight} onChange={(v) => setLabelWeight(v)} />
                        </InlineStack>
                      </BlockStack>
                    </InlineStack>
                  </div>
                  {/* Row 3: Gift Text */}
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">
                      <BlockStack>
                        <Text as="h4" variant="headingSm">Gift Text</Text>
                        <InlineStack gap="200">
                          <TextField label="Font Size" value={giftTextSize} onChange={(v: string) => setGiftTextSize(v)} autoComplete="off" type="number" />
                          <Select label="Font weight" options={[{ label: 'Regular (400)', value: '400' }, { label: 'Bold (700)', value: '700' }]} value={giftTextWeight} onChange={(v) => setGiftTextWeight(v)} />
                        </InlineStack>
                      </BlockStack>
                      <div></div> {/* Empty space for alignment */}
                    </InlineStack>
                  </div>
                </div>

                {/* 4. Colors controls */}
                <div style={{ marginTop: 12 }}>
                  <Text as="h4" variant="headingSm">Colors</Text>
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">
                      <div>
                        <Text as="p" variant="bodySm">Cards bg</Text>
                        <input type="color" style={{ border: 'none' }} value={cardsBg} onChange={(e) => setCardsBg(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Selected bg</Text>
                        <input type="color" style={{ border: 'none' }} value={selectedBg} onChange={(e) => setSelectedBg(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Border color</Text>
                        <input type="color" style={{ border: 'none' }} value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Block title</Text>
                        <input type="color" style={{ border: 'none' }} value={blockTitleColor} onChange={(e) => setBlockTitleColor(e.target.value)} />
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">

                      <div>
                        <Text as="p" variant="bodySm">Title</Text>
                        <input type="color" style={{ border: 'none' }} value={barTitleColor} onChange={(e) => setBarTitleColor(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Subtitle</Text>
                        <input type="color" style={{ border: 'none' }} value={barSubtitleColor} onChange={(e) => setBarSubtitleColor(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Price</Text>
                        <input type="color" style={{ border: 'none' }} value={priceColor} onChange={(e) => setPriceColor(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Full price</Text>
                        <input type="color" style={{ border: 'none' }} value={fullPriceColor} onChange={(e) => setFullPriceColor(e.target.value)} />
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">

                      <div>
                        <Text as="p" variant="bodySm">Label/Badge bg</Text>
                        <input type="color" style={{ border: 'none' }} value={labelBg} onChange={(e) => setLabelBg(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Label/Badge text</Text>
                        <input type="color" style={{ border: 'none' }} value={labelText} onChange={(e) => setLabelText(e.target.value)} />
                      </div>
                      {/* {getDynamicBadge(bar.priceType, bar.priceValue, bar.quantity)} */}

                      <div>
                        <Text as="p" variant="bodySm">Gift bg</Text>
                        <input type="color" style={{ border: 'none' }} value={giftBg} onChange={(e) => setGiftBg(e.target.value)} />
                      </div>
                      <div>
                        <Text as="p" variant="bodySm">Gift text</Text>
                        <input type="color" style={{ border: 'none' }} value={giftTextColor} onChange={(e) => setGiftTextColor(e.target.value)} />
                      </div>
                    </InlineStack>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <InlineStack gap="400">
                      <div>
                        <Text as="p" variant="bodySm">Gift border</Text>
                        <input type="color" style={{ border: 'none' }} value={giftBorderColor} onChange={(e) => setGiftBorderColor(e.target.value)} />
                      </div>
                    </InlineStack>
                  </div>
                </div>

                {/* 5. Bar Settings */}
                <div style={{ marginTop: 12 }}>
                  {discountBars.map((bar, index) => (
                    <div
                      key={bar.id}
                      style={{
                        marginBottom: index < discountBars.length - 1 ? '16px' : '0',
                        opacity: draggedBarId === bar.id ? 0.5 : 1,
                        cursor: 'move'
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, bar.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, bar.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <Card>
                        <div>
                          {/* Update the bar header layout: */}
                          <div style={{ marginBottom: 12 }}>
                            <InlineStack align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <div style={{ cursor: 'grab' }}>
                                  <DragHandleIcon />
                                </div>
                                <Text as="h4" variant="headingSm">{bar.barTitle}</Text>
                              </InlineStack>
                              <InlineStack gap="200" blockAlign="center">
                                <Button
                                  icon={PlusIcon}
                                  onClick={() => addBarBelow(bar.id)}
                                  size="slim"
                                  accessibilityLabel="Add bar below"
                                />
                                {discountBars.length > 1 && (
                                  <Button
                                    icon={DeleteIcon}
                                    onClick={() => removeBar(bar.id)}
                                    size="slim"
                                    tone="critical"
                                  />
                                )}
                                <Button
                                  icon={openBars.has(bar.id) ? ChevronUpIcon : ChevronDownIcon}
                                  onClick={() => toggleBar(bar.id)}
                                  size="slim"
                                  accessibilityLabel={openBars.has(bar.id) ? "Collapse bar" : "Expand bar"}
                                />
                              </InlineStack>
                            </InlineStack>
                          </div>

                          <Collapsible open={openBars.has(bar.id)} id={`bar-${bar.id}`}>
                            <div style={{ padding: '0 16px 16px 16px' }}>
                              <BlockStack gap="300">
                                <TextField
                                  label="Bar Title"
                                  value={bar.barTitle}
                                  onChange={(value) => updateBar(bar.id, 'barTitle', value)}
                                  autoComplete="off"
                                />
                                <TextField
                                  label="Title"
                                  value={bar.title}
                                  onChange={(value) => updateBar(bar.id, 'title', value)}
                                  autoComplete="off"
                                />
                                <TextField
                                  label="Description"
                                  value={bar.description}
                                  onChange={(value) => updateBar(bar.id, 'description', value)}
                                  autoComplete="off"
                                />
                                <TextField
                                  label="Badge Text"
                                  value={bar.badge}
                                  onChange={(value) => updateBar(bar.id, 'badge', value)}
                                  autoComplete="off"
                                />
                                <TextField
                                  label="Quantity"
                                  value={bar.quantity.toString()}
                                  onChange={(value) => updateBar(bar.id, 'quantity', parseInt(value) || 1)}
                                  autoComplete="off"
                                  type="number"
                                  min="1"
                                />

                                {/* Price Settings */}
                                <div>
                                  <div style={{ marginBottom: 8 }}>
                                    <Text as="h4" variant="headingSm">Price Settings</Text>
                                  </div>
                                  <BlockStack gap="200">
                                    <Select
                                      label="Price Type"
                                      options={[
                                        { label: 'Percentage off', value: 'percentage' },
                                        { label: 'Amount off', value: 'amount_off' },
                                        { label: 'Exact price', value: 'exact_price' }
                                      ]}
                                      value={bar.priceType}
                                      onChange={(value) => updateBar(bar.id, 'priceType', value)}
                                    />
                                    <TextField
                                      label={
                                        bar.priceType === 'percentage' ? 'Percentage (%)' :
                                          bar.priceType === 'amount_off' ? 'Amount off (£)' :
                                            'Exact price (£)'
                                      }
                                      value={bar.priceValue.toString()}
                                      onChange={(value) => updateBar(bar.id, 'priceValue', parseFloat(value) || 0)}
                                      autoComplete="off"
                                      type="number"
                                      min="0"
                                      step={bar.priceType === 'percentage' ? 1 : 0.01}
                                      prefix={bar.priceType === 'percentage' ? undefined : '£'}
                                    />
                                  </BlockStack>
                                </div>

                                {/* Free Gift Settings */}
                                <div>
                                  <div style={{ marginBottom: 8 }}>
                                    <InlineStack align="space-between" blockAlign="center">
                                      <Text as="h4" variant="headingSm">Free Gift</Text>
                                      {!bar.gift ? (
                                        <Button
                                          onClick={() => addGift(bar.id)}
                                          size="slim"
                                        >
                                          Add Free Gift
                                        </Button>
                                      ) : (
                                        <InlineStack gap="200">
                                          <Button
                                            onClick={() => toggleGift(bar.id)}
                                            size="slim"
                                            icon={giftOpenBars.has(bar.id) ? ChevronUpIcon : ChevronDownIcon}
                                          >
                                            {giftOpenBars.has(bar.id) ? 'Hide' : 'Show'} Gift
                                          </Button>
                                          <Button
                                            onClick={() => removeGift(bar.id)}
                                            size="slim"
                                            tone="critical"
                                            icon={DeleteIcon}
                                          >
                                            Remove Gift
                                          </Button>
                                        </InlineStack>
                                      )}
                                    </InlineStack>
                                  </div>

                                  {bar.gift && (
                                    <Collapsible open={giftOpenBars.has(bar.id)} id={`gift-${bar.id}`}>
                                      <BlockStack gap="200">
                                        <TextField
                                          label="Gift Text"
                                          value={bar.gift.text}
                                          onChange={(value) => updateGift(bar.id, 'text', value)}
                                          autoComplete="off"
                                          placeholder="e.g., Free Gift, Bonus Item"
                                        />

                                        {/* Variant Picker for Gift */}
                                        <div>
                                          <p style={{ marginBottom: 8 }}>Select Gift Variant</p>
                                          <ProductPicker
                                            onSelect={(selected) => handleGiftProductSelect(bar.id, selected)}
                                            selectedIds={bar.gift.giftVariantId ? [bar.gift.giftVariantId] : []}
                                            items={bar.gift.giftVariantId && bar.gift.giftVariantTitle ? [{ id: bar.gift.giftVariantId, title: bar.gift.giftVariantTitle, imageUrl: bar.gift.imageUrl }] : []}
                                            type="variant"
                                            buttonText="Select gift variant"
                                          />
                                        </div>

                                        {/* Gift quantity */}
                                        <div>
                                          <TextField
                                            label="Free gift quantity"
                                            type="number"
                                            min="1"
                                            value={(bar.gift.quantity ?? 1).toString()}
                                            onChange={(value) => updateGift(bar.id, 'quantity', Math.max(1, parseInt(value) || 1))}
                                            autoComplete="off"
                                          />
                                        </div>

                                        {/* Image Size (uses product image if available) */}
                                        {bar.gift.imageUrl ? (
                                          <div>
                                            <p>Gift Image</p>
                                            <BlockStack gap="200">
                                              <TextField
                                                label="Image Size (px)"
                                                value={bar.gift.imageSize.toString()}
                                                onChange={(value) => updateGift(bar.id, 'imageSize', parseInt(value) || 50)}
                                                autoComplete="off"
                                                type="number"
                                                min="1"
                                                max="100"
                                                helpText="Using product featured image. Size 1-100px."
                                              />
                                            </BlockStack>
                                          </div>
                                        ) : null}
                                      </BlockStack>
                                    </Collapsible>
                                  )}
                                </div>
                              </BlockStack>
                            </div>
                          </Collapsible>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </Collapsible>
            </Card>
          </div>
        </Form>

        {/* Right: sticky preview */}
        <div style={{ width: '50%', position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
          <Card>
            <div style={{ padding: '16px' }}>
              <Text as="h2" variant="headingMd">Preview</Text>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, padding: 16, background: cardsBg }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 1, background: '#E1E3E5' }} />
                  <div style={{ fontSize: `${titleFontSize}px`, color: blockTitleColor, fontWeight: Number(titleWeight) }}>
                    {blockTitle}
                  </div>
                  <div style={{ flex: 1, height: 1, background: '#E1E3E5' }} />
                </div>
                <div>
                  {discountBars.map((bar) => (
                    <div
                      key={bar.id}
                      style={{
                        flex: 1,
                        border: selectedBarId === bar.id ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
                        borderRadius: 8,
                        padding: 12,
                        background: selectedBarId === bar.id ? selectedBg : cardsBg,
                        cursor: 'pointer',
                        marginBottom: 12,
                      }}
                      onClick={() => setSelectedBarId(bar.id)}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <input type="radio" name="pack" checked={selectedBarId === bar.id} readOnly />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: `${optionHeadingSize}px`, fontWeight: Number(optionHeadingWeight), color: barTitleColor }}>
                                {bar.title}
                              </div>
                              <div style={{ display: 'inline-block', background: labelBg, color: labelText, borderRadius: 8, padding: '2px 8px', fontSize: `${labelSize}px`, fontWeight: Number(labelWeight) }}>
                                {getDynamicBadge(bar.priceType, bar.priceValue, bar.quantity)}
                              </div>
                            </div>
                            <div style={{ fontSize: `${optionDescSize}px`, fontWeight: Number(optionDescWeight), color: barSubtitleColor }}>
                              <span>{bar.description}</span>
                            </div>
                          </div>
                        </InlineStack>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: priceColor, fontWeight: 700 }}>
                            {(() => {
                              const basePrice = 22.50;
                              const totalComparePrice = basePrice * bar.quantity;

                              if (bar.priceType === 'percentage') {
                                return `£${(totalComparePrice * (1 - bar.priceValue / 100)).toFixed(2)}`;
                              } else if (bar.priceType === 'amount_off') {
                                return `£${Math.max(0, totalComparePrice - bar.priceValue).toFixed(2)}`;
                              } else {
                                return `£${(bar.priceValue * bar.quantity).toFixed(2)}`;
                              }
                            })()}
                          </div>
                          <div style={{ color: fullPriceColor, textDecoration: 'line-through', marginTop: 2 }}>
                            £{(22.50 * bar.quantity).toFixed(2)}
                          </div>
                        </div>
                      </InlineStack>

                      {/* Gift section with separator line and background */}
                      {bar.gift && (
                        <div style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: `1px solid ${giftBorderColor}`,
                          background: giftBg,
                          borderRadius: 6,
                          padding: 12,
                          margin: '12px -12px -12px -12px',
                          borderBottomLeftRadius: 8,
                          borderBottomRightRadius: 8
                        }}>
                          <InlineStack gap="200" blockAlign="center">
                            {/* Show image only if imageUrl is provided */}
                            {bar.gift.imageUrl && (
                              <div style={{
                                width: `${bar.gift.imageSize}px`,
                                height: `${bar.gift.imageSize}px`,
                                backgroundColor: '#f0f0f0',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                color: '#666',
                                border: `1px solid ${giftBorderColor}`
                              }}>
                                <img
                                  src={bar.gift.imageUrl}
                                  alt={bar.gift.text}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    borderRadius: 4
                                  }}
                                />
                              </div>
                            )}

                            <div>
                              <div style={{
                                fontSize: `${giftTextSize}px`,
                                fontWeight: Number(giftTextWeight),
                                color: giftTextColor,
                                marginBottom: 4
                              }}>
                                {bar.gift.text}
                              </div>
                              {bar.gift.giftVariantTitle && (
                                <div style={{
                                  fontSize: `${optionDescSize}px`,
                                  color: barSubtitleColor
                                }}>
                                  {bar.gift.giftVariantTitle}
                                </div>
                              )}
                            </div>
                          </InlineStack>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
