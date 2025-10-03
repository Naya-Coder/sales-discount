import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect, useFetcher } from "@remix-run/react";
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
import { getWidgetSettingsByShop,deleteDiscountSettings } from "app/models/db.prisma";
import { getFunctions } from "../models/functions.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const functions = await getFunctions(request);
  const widgets = await getWidgetSettingsByShop(session.shop);
  return json({ widgets, functions, shop });
};

export default function Index() {
  const navigate = useNavigate();
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

  // Handle delete
  const handleDiscountDelete = async (id: string) => {
    try {
      await deleteDiscountSettings(shop, id);
      // Filter out the deleted widget
      setWidgets(prev => prev.filter(widget => widget.id !== id));
    } catch (error) {
      console.error("Failed to delete discount:", error);
    }
  };

  const rowMarkup = widgets.map((widget, index) => (
    <IndexTable.Row id={widget.id.toString()} key={widget.id} position={index}>
      <IndexTable.Cell>
        <Text fontWeight="bold" as="span">
          {widget?.bundleName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={widget?.widgetSettings[0].status ? "success" : "critical"}>
          {widget?.widgetSettings[0].status ? "Active" : "Inactive"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {widget.discountName ?? "—"}
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
        <Button
          variant="primary"
          tone="critical"
          onClick={() => handleDiscountDelete(widget.id.toString())}
          style={{ marginLeft: "8px" }}
        >
          Delete
        </Button>
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
