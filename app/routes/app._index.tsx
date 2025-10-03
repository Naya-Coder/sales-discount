import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect, useFetcher, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  EmptySearchResult,
  IndexTable,
  useBreakpoints,
  useIndexResourceState,
  Badge,
  ActionList,
  Popover,
  ButtonGroup,
} from "@shopify/polaris";
import { PlusIcon } from '@shopify/polaris-icons';

import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useNavigate, useLoaderData } from "@remix-run/react";
import { getWidgetSettingsByShop, deleteDiscountSettings } from "../models/db.prisma.server";
import { getFunctions } from "../models/functions.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  try {
    // Try to get functions, but don't fail if it doesn't work
    let functions = [];
    try {
      functions = await getFunctions(request);
    } catch (error) {
      console.warn("Could not fetch functions:", error);
      // Use a fallback function ID if available
      functions = [{ id: process.env.DISCOUNT_FUNCTION_ID || "fallback-id", title: "Discount Function" }];
    }
    
    const widgets = await getWidgetSettingsByShop(session.shop);
    return json({ widgets, functions, session, shop });
  } catch (error) {
    console.error("Loader error:", error);
    // Return minimal data to prevent 500 error
    return json({ 
      widgets: [], 
      functions: [{ id: process.env.DISCOUNT_FUNCTION_ID || "fallback-id", title: "Discount Function" }], 
      session, 
      shop 
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const widgetId = formData.get("widgetId");

  if (action === "delete" && widgetId) {
    try {
      await deleteDiscountSettings(session.shop, widgetId.toString());
      return json({ success: true, message: "Widget deleted successfully" });
    } catch (error) {
      console.error("Failed to delete widget:", error);
      return json({ success: false, message: "Failed to delete widget" }, { status: 500 });
    }
  }

  return json({ success: false, message: "Invalid action" }, { status: 400 });
};

export default function Index() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { widgets: initialWidgets, functions, shop } = useLoaderData<typeof loader>();
  const [widgets, setWidgets] = useState(initialWidgets);
  const [button, setButton] = useState(false);

  const resourceName = {
    singular: "widget",
    plural: "widgets",
  };

  const emptyStateMarkup = (
    <EmptySearchResult
      title={"No widget discount found yet"}
      description={"Try creating a discount"}
      withIllustration
    />
  );

  // Handle delete using form submission
  const handleDiscountDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this widget?")) {
      fetcher.submit(
        { action: "delete", widgetId: id },
        { method: "post" }
      );
    }
  };

  // Update widgets when delete is successful
  useEffect(() => {
    if (fetcher.data && typeof fetcher.data === 'object' && 'success' in fetcher.data && fetcher.data.success) {
      const widgetId = fetcher.formData?.get("widgetId");
      if (widgetId) {
        setWidgets(prev => prev.filter(widget => widget.id !== parseInt(widgetId.toString())));
      }
    }
  }, [fetcher.data, fetcher.formData]);

  const rowMarkup = widgets.map((widget, index) => (
    <IndexTable.Row id={widget.id.toString()} key={widget.id} position={index}>
      <IndexTable.Cell>
        <Text fontWeight="bold" as="span">
          {widget?.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={widget?.status ? "success" : "critical"}>
          {widget?.status ? "Active" : "Inactive"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {widget.discounts?.[0]?.discountName ?? "—"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{new Date(widget.createdAt).toLocaleDateString()}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          variant="primary"
          onClick={() => navigate(`/app/discount/${functions[0].id}/${widget.id}`)}
        >
          Edit
        </Button>
        <div style={{ marginLeft: "8px", display: "inline-block" }}>
          <Button
            variant="primary"
            tone="critical"
            onClick={() => handleDiscountDelete(widget.id.toString())}
            loading={fetcher.state === "submitting" && fetcher.formData?.get("widgetId") === widget.id.toString()}
          >
            Delete
          </Button>
        </div>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <>
      <TitleBar title="Sales Discount Dashboard" />
      <div style={{ padding: "0 4rem" }}>
        <div style={{ display: "inline-flex", justifyContent: "end", width: "100%", marginBottom: "1rem" }}>
          <ButtonGroup>
            <div style={{ width: '3px' }} />
            <Popover
              active={button}
              preferredAlignment="right"
              activator={
                <Button
                  variant="primary"
                  onClick={() => setButton(true)}
                  icon={PlusIcon}
                  accessibilityLabel="Other save actions"
                >
                  Create Discount
                </Button>
              }
              autofocusTarget="first-node"
              onClose={() => setButton(false)}
            >
              <ActionList
                actionRole="menuitem"
                items={[{ content: 'Quantity breaks for the same product' }]}
                onActionAnyItem={() => {
                  setButton(false);
                  navigate(`/app/discount/${functions[0].id}/new?type=quantity`);
                }}
              />
              <ActionList
                actionRole="menuitem"
                items={[{ content: 'Buy X, get Y free (BOGO) deal' }]}
                onActionAnyItem={() => {
                  setButton(false);
                  navigate(`/app/discount/${functions[0].id}/new?type=bogo`);
                }}
              />
            </Popover>
          </ButtonGroup>
        </div>
        <Card>
          <IndexTable
            condensed={useBreakpoints().smDown}
            resourceName={resourceName}
            itemCount={widgets.length}
            emptyState={emptyStateMarkup}
            headings={[
              { title: "Title" },
              { title: "Status" },
              { title: "Discount" },
              { title: "Created" },
              { title: "Actions" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      </div>
    </>
  );
}
