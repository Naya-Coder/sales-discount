document.addEventListener("DOMContentLoaded", function () {
    // const rawPrice = PRODUCT_PRICE; // e.g., "41,999.00"
    // const priceNumber = Number(String(rawPrice).replace(/,/g, ''));
    const target = document.querySelector('#pv-sales-block') || document.querySelector('.pv-sales-block');
    if (!target) return;

    showSkeleton(target, 2); // show 2 placeholder bars

    fetch(`/apps/discount?id=${PRODUCT_ID}`, {
        method: "GET",
        headers: { Accept: "application/json" },
    })
        .then(res => res.json())
        .then(data => {
            console.log('API Response:', data);
            
            // Handle new response format
            if (!data || !data.widgetSettings || data.widgetSettings.length === 0) {
                const target = document.querySelector('#pv-sales-block') || document.querySelector('.pv-sales-block');
                if (target) target.innerHTML = ''; // remove skeleton
                return;
            }

            // Get the first widget setting and its associated widget
            const widgetSetting = data.widgetSettings[0];
            const widget = widgetSetting.widget;
            
            if (!widget || !widget.settings) {
                const target = document.querySelector('#pv-sales-block') || document.querySelector('.pv-sales-block');
                if (target) target.innerHTML = ''; // remove skeleton
                return;
            }

            const settings = typeof widget.settings === 'string' 
                ? JSON.parse(widget.settings) 
                : widget.settings;
            
            // Get template type for future use
            const template = widget.template || 'quantity-breaks';
            console.log('Widget template:', template);
            console.log('Widget settings:', settings);
            
            const target = document.querySelector('#pv-sales-block') || document.querySelector('.pv-sales-block');
            if (!target) return;

            // Render different UI based on template type
            if (template === 'bxgy') {
                renderBxgyWidget(target, settings, widgetSetting);
            } else {
                renderQuantityBreaksWidget(target, settings, widgetSetting);
            }
        })
        .catch(err => console.error(err));

    // As a safety net, ensure the property is present before any /cart/add form submits
    document.addEventListener('submit', function(e) {
        const target = e.target;
        if (!(target instanceof HTMLFormElement)) return;
        if (!target.matches('form[action^="/cart/add"]')) return;

        const quantityInput = document.querySelector('input[name="quantity"]');
        const selectedQuantity = quantityInput && quantityInput.value ? Number(quantityInput.value) : 1;
        // Ensure _quantity and other properties are set on submit
        try {
            const selectedBarEl = document.querySelector('.bar-option input[type="radio"]:checked');
            if (selectedBarEl && window.__PV_WIDGET_BARS__) {
                const index = Array.from(document.querySelectorAll('.bar-option input[type="radio"]')).indexOf(selectedBarEl);
                const bar = window.__PV_WIDGET_BARS__[index];
                if (bar) setLineItemPropertiesFromBar({ ...bar, quantity: selectedQuantity });
            } else {
                setLineItemPropertiesFromBar({ quantity: selectedQuantity });
            }
        } catch (err) {}
        
        // If we can infer a selected bar from UI, also set gift-related properties
        try {
            const selectedBarEl = document.querySelector('.bar-option input[type="radio"]:checked');
            if (selectedBarEl) {
                // This assumes we can map back to the bar by index
                const index = Array.from(document.querySelectorAll('.bar-option input[type="radio"]')).indexOf(selectedBarEl);
                if (window.__PV_WIDGET_BARS__ && Array.isArray(window.__PV_WIDGET_BARS__) && window.__PV_WIDGET_BARS__[index]) {
                    setLineItemPropertiesFromBar(window.__PV_WIDGET_BARS__[index]);
                }
            }
        } catch (err) {}
    }, true);
});

function renderQuantityBreaksWidget(target, settings, widgetSetting) {
    const container = document.createElement('div');
    container.style.cssText = `
        border: 1px solid ${settings.colors?.borderColor || '#E1E3E5'}; 
        border-radius: 8px;
        padding: 16px;
        background: ${settings.colors?.cardsBg || '#FFFFFF'};
    `;

    // Title row
    if (settings.block?.title) {
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'margin-bottom:12px;display:flex;align-items:center;gap:12px;';
        const line = () => {
            const el = document.createElement('div');
            el.style.cssText = 'flex:1;height:1px;background:#E1E3E5;';
            return el;
        };
        const title = document.createElement('div');
        title.textContent = settings.block.title;
        title.style.cssText = `
            font-size:${settings.typography?.titleFontSize || 16}px;
            color:${settings.colors?.blockTitleColor || '#111213'};
            font-weight:${settings.typography?.titleWeight || 600};
        `;
        titleRow.appendChild(line());
        titleRow.appendChild(title);
        titleRow.appendChild(line());
        container.appendChild(titleRow);
    }

    // Bars wrapper
    const barsWrap = document.createElement('div');
    barsWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    // Keep track of selected bar (last bar by default)
    let selectedBar = settings.bars[settings.bars.length - 1];

    const bars = settings.bars || [];
    // Expose bars globally for submit-time mapping if needed
    try { window.__PV_WIDGET_BARS__ = bars; } catch (e) {}

    bars.forEach((bar, index) => {
        const isSelected = index === settings.bars.length - 1; // last bar pre-selected
        const barEl = createBarEl(bar, settings, isSelected);

        // If this is the selected bar on load, set quantity
        if (isSelected) {
            const quantityInput = document.querySelector('input[name="quantity"]');
            if (quantityInput) {
                quantityInput.value = bar.quantity || 1;
                quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // Ensure line item properties are set on all add-to-cart forms on initial render
            try { setLineItemPropertiesFromBar(bar); } catch (e) {}
        }

        // Click handler for all bars
        barEl.addEventListener('click', () => {
            // Remove selectedBg from all bars and uncheck radios
            barsWrap.querySelectorAll('.bar-option').forEach(b => {
                b.style.background = settings.colors?.cardsBg || '#FFFFFF';
                const input = b.querySelector('input[type="radio"]');
                if (input) input.checked = false;
            });

            // Highlight clicked bar and check radio
            barEl.style.background = settings.colors?.selectedBg || '#EEF3FF';
            const radio = barEl.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;

            selectedBar = bar;

            // Update quantity input
            const quantityInput = document.querySelector('input[name="quantity"]');
            if (quantityInput) {
                quantityInput.value = bar.quantity || 1;
                quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Update hidden properties on all add-to-cart forms
            try { setLineItemPropertiesFromBar(bar); } catch (e) {}
        });

        barsWrap.appendChild(barEl);
    });

    container.appendChild(barsWrap);
    target.innerHTML = '';
    target.appendChild(container);
}

function renderBxgyWidget(target, settings, widgetSetting) {
    // Placeholder for Buy X Get Y widget
    const container = document.createElement('div');
    container.style.cssText = `
        border: 1px solid ${settings.colors?.borderColor || '#E1E3E5'}; 
        border-radius: 8px;
        padding: 16px;
        background: ${settings.colors?.cardsBg || '#FFFFFF'};
        text-align: center;
    `;
    
    const placeholder = document.createElement('div');
    placeholder.textContent = 'Buy X Get Y Widget - Coming Soon';
    placeholder.style.cssText = `
        color: ${settings.colors?.barTitleColor || '#111213'};
        font-size: 16px;
        font-weight: 600;
    `;
    
    container.appendChild(placeholder);
    target.innerHTML = '';
    target.appendChild(container);
}

function createBarEl(bar, settings, isSelected = false) {
    const el = document.createElement('div');
    el.classList.add('bar-option');
    el.style.cssText = `
        border:1px solid ${settings.colors?.borderColor || '#E1E3E5'};
        border-radius:8px;
        padding:12px;
        background:${isSelected ? settings.colors?.selectedBg : settings.colors?.cardsBg || '#FFFFFF'};
        cursor:pointer;
        display:flex;
        justify-content:space-between;
        align-items:center;
    `;

    // Radio input (hidden)
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'discountBar';
    radio.value = bar.id;
    radio.checked = isSelected;
    radio.style.display = 'none';
    el.appendChild(radio);

    // Left content
    const left = document.createElement('div');
    left.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const title = document.createElement('span');
    title.textContent = bar.title;
    title.style.cssText = `
        font-size:${settings.typography?.optionHeadingSize || 14}px;
        font-weight:${settings.typography?.optionHeadingWeight || 700};
        color:${settings.colors?.barTitleColor || '#111213'};
    `;
    const badge = document.createElement('span');
    const saved = calcSavedAmount(bar);
    badge.textContent = saved > 0 ? `SAVE ${formatPrice(saved)}` : '';
    badge.style.cssText = `
        display:inline-block;background:${settings.colors?.labelBg || '#D9D9D9'};
        color:${settings.colors?.labelText || '#111213'};
        border-radius:8px;padding:2px 8px;
        font-size:${settings.typography?.labelSize || 12}px;
        font-weight:${settings.typography?.labelWeight || 400};
    `;
    titleRow.appendChild(title);
    titleRow.appendChild(badge);

    const desc = document.createElement('div');
    // Calculate the actual savings amount to show in description
    const savedAmount = calcSavedAmount(bar);
    const originalPrice = calcOriginalPrice(bar);
    const discountPercent = originalPrice > 0 ? Math.round((savedAmount / originalPrice) * 100) : 0;
    
    // Show calculated savings in description
    if (savedAmount > 0) {
        desc.textContent = `You save ${formatPrice(savedAmount)} (${discountPercent}% off)`;
    } else {
        desc.textContent = bar.description || '';
    }
    
    desc.style.cssText = `
        font-size:${settings.typography?.optionDescSize || 12}px;
        font-weight:${settings.typography?.optionDescWeight || 400};
        color:${settings.colors?.barSubtitleColor || '#5C5F62'};
    `;

    left.appendChild(titleRow);
    left.appendChild(desc);

    // Right: price
    const right = document.createElement('div');
    right.style.textAlign = 'right';
    const price = document.createElement('div');
    price.textContent = formatPrice(calcPrice(bar));
    price.style.cssText = `
        color:${settings.colors?.priceColor || '#111213'};
        font-weight:700;font-size:16px;
    `;
    const original = document.createElement('div');
    original.textContent = formatPrice(calcOriginalPrice(bar));
    original.style.cssText = `
        color:${settings.colors?.fullPriceColor || '#5C5F62'};
        text-decoration:line-through;margin-top:2px;font-size:14px;
    `;
    right.appendChild(price);
    right.appendChild(original);

    el.appendChild(left);
    el.appendChild(right);

    // Gift section
    if (bar.gift) el.appendChild(createGiftEl(bar.gift, settings));

    return el;
}

// Price calculation helpers
function calcPrice(bar) {
    const basePrice = Number(String(PRODUCT_PRICE || 22.5).replace(/,/g, ''));;
    const quantity = bar.quantity || 1;
    let discounted = basePrice * quantity;

    if (bar.priceType === 'percentage') {
        discounted = discounted * (1 - (bar.priceValue || 0) / 100);
    } else if (bar.priceType === 'amount_off') {
        discounted = Math.max(0, discounted - (bar.priceValue || 0));
    } else if (bar.priceType === 'exact_price') {
        discounted = (bar.priceValue || 0) * quantity;
    }

    return discounted;
}

function calcOriginalPrice(bar) {
    const basePrice = Number(String(PRODUCT_PRICE || 22.5).replace(/,/g, ''));;
    return basePrice * (bar.quantity || 1);
}

function calcSavedAmount(bar) {
    return calcOriginalPrice(bar) - calcPrice(bar);
}

function formatPrice(amount) {
    const currency = PRODUCT_CURRENCY || 'GBP'; // Use a valid ISO code
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function showSkeleton(target, barsCount = 2) {
    const skeleton = document.createElement('div');
    skeleton.classList.add('skeleton-wrapper');
    skeleton.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:16px;';

    for (let i = 0; i < barsCount; i++) {
        const barSkeleton = document.createElement('div');
        barSkeleton.style.cssText = `
            height: 60px;
            background: #f0f0f0;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
        `;
        // Animated shimmer
        const shimmer = document.createElement('div');
        shimmer.style.cssText = `
            position: absolute;
            top:0;left:-100%;
            width:100%;height:100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
            animation: shimmer 1.5s infinite;
        `;
        barSkeleton.appendChild(shimmer);
        skeleton.appendChild(barSkeleton);
    }

    target.innerHTML = '';
    target.appendChild(skeleton);
}

// Set multiple properties for all add-to-cart forms from a bar definition
function setLineItemPropertiesFromBar(bar) {
    const forms = document.querySelectorAll('form[action^="/cart/add"]');
    if (!forms || !forms.length) return;

    const selectedQuantity = bar?.quantity || 1;
    const gift = bar?.gift || null;

    forms.forEach((form) => {
        // _quantity property
        let qtyInput = form.querySelector('input[name="properties[_quantity]"]');
        if (!qtyInput) {
            qtyInput = document.createElement('input');
            qtyInput.type = 'hidden';
            qtyInput.name = 'properties[_quantity]';
            form.appendChild(qtyInput);
        }
        qtyInput.value = String(selectedQuantity);

        // giftProduct flag (hidden via underscore)
        let giftFlag = form.querySelector('input[name="properties[_giftProduct]"]');
        if (!giftFlag) {
            giftFlag = document.createElement('input');
            giftFlag.type = 'hidden';
            giftFlag.name = 'properties[_giftProduct]';
            form.appendChild(giftFlag);
        }
        giftFlag.value = gift ? 'true' : 'false';

        // quantity (explicit, hidden via underscore)
        let quantityProp = form.querySelector('input[name="properties[_quantity]"]');
        if (!quantityProp) {
            quantityProp = document.createElement('input');
            quantityProp.type = 'hidden';
            quantityProp.name = 'properties[_quantity]';
            form.appendChild(quantityProp);
        }
        quantityProp.value = String(selectedQuantity);

        // variant-id if provided on gift (hidden via underscore)
        let variantProp = form.querySelector('input[name="properties[_variant-id]"]');
        if (!variantProp) {
            variantProp = document.createElement('input');
            variantProp.type = 'hidden';
            variantProp.name = 'properties[_variant-id]';
            form.appendChild(variantProp);
        }
        let variantId = gift && (gift.giftVariantId || gift.variantId || gift.variant_id || gift.id);
        if (variantId != null) {
            // Normalize Shopify GID to numeric id if provided in gid:// format
            try {
                const match = String(variantId).match(/ProductVariant\/(\d+)/);
                if (match && match[1]) variantId = match[1];
            } catch (e) {}
            variantProp.value = String(variantId);
        } else {
            // Clear if no gift
            variantProp.value = '';
        }
    });
}

function createGiftEl(gift, settings) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        margin-top:12px;
        padding:12px;
        border-top:1px solid ${settings.gift?.borderColor || '#E1E3E5'};
        background:${settings.gift?.bg || '#F8F9FA'};
        border-radius:6px;
    `;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';

    // Gift image
    if (gift.imageUrl) {
        const img = document.createElement('img');
        img.src = gift.imageUrl;
        img.alt = gift.text || 'Gift';
        img.style.cssText = `
            width:${gift.imageSize || 50}px;
            height:${gift.imageSize || 50}px;
            object-fit:cover;
            border-radius:4px;
            border:1px solid ${settings.gift?.borderColor || '#E1E3E5'};
        `;
        row.appendChild(img);
    }

    // Gift text
    const textCol = document.createElement('div');
    textCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    const text = document.createElement('div');
    text.textContent = gift.text || '+ Free Gift';
    text.style.cssText = `
        font-size:${settings.gift?.textSize || 12}px;
        font-weight:${settings.gift?.textWeight || 400};
        color:${settings.gift?.textColor || '#111213'};
    `;
    textCol.appendChild(text);

    // Optional variant title
    if (gift.giftVariantTitle) {
        const sub = document.createElement('div');
        sub.textContent = gift.giftVariantTitle;
        sub.style.cssText = `
            font-size:${settings.typography?.optionDescSize || 12}px;
            color:${settings.colors?.barSubtitleColor || '#5C5F62'};
        `;
        textCol.appendChild(sub);
    }

    row.appendChild(textCol);
    wrap.appendChild(row);

    return wrap;
}
