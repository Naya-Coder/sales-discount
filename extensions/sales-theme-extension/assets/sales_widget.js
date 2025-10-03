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
            const record = Array.isArray(data) ? data[0] : data;
            console.log(record);
            
            if (record && record?.widgetSettings.length == 0) {
                const target = document.querySelector('#pv-sales-block') || document.querySelector('.pv-sales-block');
                if (target) target.innerHTML = ''; // remove skeleton
                return;
            }

            const settings = JSON.parse(record.widgetSettings[0].widgetSettings[0].settings);
            const target = document.querySelector('#pv-sales-block') || document.querySelector('.pv-sales-block');
            if (!target) return;

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

            // Keep track of selected bar
            // Keep track of selected bar (last bar by default)
            let selectedBar = settings.bars[settings.bars.length - 1];

            (settings.bars || []).forEach((bar, index) => {
                const isSelected = index === settings.bars.length - 1; // last bar pre-selected
                const barEl = createBarEl(bar, settings, isSelected);

                // If this is the selected bar on load, set quantity
                if (isSelected) {
                    const quantityInput = document.querySelector('input[name="quantity"]');
                    if (quantityInput) {
                        quantityInput.value = bar.quantity || 1;
                        quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
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
                });

                barsWrap.appendChild(barEl);
            });


            container.appendChild(barsWrap);
            target.innerHTML = '';
            target.appendChild(container);
        })
        .catch(err => console.error(err));
});

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
    desc.textContent = bar.description || '';
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
