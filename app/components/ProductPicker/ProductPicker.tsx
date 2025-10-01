import {
  Button,
  BlockStack,
  InlineStack,
  Link,
  Divider,
  Select,
  TextField,
  Icon,
  Text,
  Card,
  Collapsible,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { useCallback, useState, useEffect } from "react";
import { PlusIcon, MinusIcon } from "@shopify/polaris-icons";

interface ResourceItem {
  id: string;
  title: string;
  imageUrl?: string;
}

interface ProductPickerProps {
  onSelect: (selectedItems: ResourceItem[]) => void;
  selectedIds: string[];
  items?: ResourceItem[];
  type?: "product" | "variant";
  buttonText?: string;
}

function firstTruthy<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) if (v) return v;
  return undefined;
}

export function ProductPicker({
  onSelect,
  selectedIds = [],
  items = [],
  type = "product",
  buttonText = "Select products",
}: ProductPickerProps) {
  // map of itemId -> boolean (open state)
  const [styleOpen, setStyleOpen] = useState(true);


  // keep openMap in sync with items: remove keys for removed items and ensure keys exist
  // useEffect(() => {
  //   setOpenMap((prev) => {
  //     const next: Record<string, boolean> = {};
  //     const ids = new Set(items.map((i) => i.id));
  //     // preserve existing open state for items that remain
  //     for (const id of Object.keys(prev)) {
  //       if (ids.has(id)) next[id] = prev[id];
  //     }
  //     // ensure every current item has an entry (default collapsed)
  //     for (const it of items) {
  //       if (!(it.id in next)) next[it.id] = false;
  //     }
  //     return next;
  //   });
  // }, [items]);

  const handleSelect = useCallback(async () => {
    const selected = await (window as any).shopify?.resourcePicker({
      type,
      action: "select",
      multiple: true,
      selectionIds: selectedIds.map((id) => ({ id, type })),
    });

    if (selected) {
      const selectedItems = selected.map((item: any) => {
        const featured = item?.images?.[0] || item?.image;
        const imagesList = item?.images || item?.media;
        const edges = imagesList?.edges || [];
        const firstEdge = edges[0]?.node;
        const firstArray = Array.isArray(imagesList) ? imagesList[0] : undefined;
        const imageUrl = firstTruthy<string>(
          featured?.url,
          featured?.src,
          featured?.originalSrc,
          firstEdge?.url,
          firstEdge?.src,
          firstEdge?.image?.url,
          firstEdge?.image?.src,
          firstArray?.url,
          firstArray?.src,
        );
        return {
          id: item.id as string,
          title: item.title as string,
          imageUrl,
          quantity: 1, // default
          discountType: "percentage", // default
          discount: 0, // default
        };
      });

      onSelect(selectedItems);
    }
  }, [selectedIds, onSelect, type]);

  const handleRemove = useCallback(
    (id: string) => {
      onSelect(items.filter((item) => item.id !== id));
    },
    [onSelect, items],
  );

  const handleFieldChange = (id: string, field: keyof ResourceItem, value: any) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item,
    );
    onSelect(updated);
  };

  const discountTypeOptions = [
    { label: "Percentage", value: "percentage" },
    { label: "Amount Off", value: "amount_off" },
    { label: "Exact Price", value: "exact_price" },
  ];

  const selectedText = items?.length ? `(${items.length} selected)` : "";

  return (
    <BlockStack gap="400">
      <Button onClick={handleSelect}>
        {buttonText}
        {selectedText}
      </Button>

      {items?.length > 0 ? (
        <BlockStack gap="400">
          <Card>

            <InlineStack align="space-between" gap="100">
              <Text variant="headingMd" as="h2">Selected {type === "product" ? "Products" : "Variants"}</Text>
              <Button
                icon={styleOpen ? ChevronUpIcon : ChevronDownIcon}
                accessibilityLabel={styleOpen ? "Collapse style & settings" : "Expand style & settings"}
                onClick={() => setStyleOpen((v) => !v)}
              />
            </InlineStack>
            {items.map((item) => {
              return (
                <BlockStack gap="500">
                  <Collapsible open={styleOpen} id="style-settings">
                    <div style={{ marginTop: 10 }} key={item.id}>
                      <InlineStack blockAlign="center" align="space-between">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          width={40}
                          height={40}
                          style={{
                            objectFit: "cover",
                            borderRadius: 4,
                            marginRight: 8,
                          }}
                        />
                        <div style={{ width: "50%", marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Link
                            url={`shopify://admin/${type === "variant" ? "variants" : "products"}/${item.id.split("/").pop()}`}
                            monochrome
                            removeUnderline
                          >
                            {item.title}
                          </Link>
                        </div>

                        <InlineStack align="center" gap="100">
                          <Button
                            variant="tertiary"
                            onClick={() => handleRemove(item.id)}
                            icon={DeleteIcon}
                          />
                        </InlineStack>
                      </InlineStack>
                    </div>
                    <Divider />
                  </Collapsible>
                </BlockStack>
              );
            })}
          </Card>
        </BlockStack>
      ) : null}
    </BlockStack>
  );
}
