document.addEventListener("DOMContentLoaded", function () {
    console.log(PRODUCT_ID)
    console.log(HANDLE)


    fetch(`/apps/discount?id=${PRODUCT_ID}`, {
        method: "GET",
        headers: { Accept: "application/json" },
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json(); // Or .text(), .blob(), etc., depending on the content type
        })
        .then(data => {
            // Handle both shapes: single object or array
            const record = Array.isArray(data) ? data[0] : data;
            console.log(record,'record in sales_widget.js');
            
            if (!record || !record?.widgetSettings) return;
            
            const settings = JSON.parse(record?.widgetSettings[0]?.widgetSettings[0]?.settings);

            const target =
                document.querySelector('#pv-sales-block') ||
                document.querySelector('.pv-sales-block');

            if (!target) {
                console.warn('pv-sales-block container not found');
                return;
            }

            // Container
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
                titleRow.style.cssText = `
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                `;
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

            // Bars
            const barsWrap = document.createElement('div');
            barsWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

            (settings.bars || []).forEach(bar => {
                const barEl = createBarEl(bar, settings);
                barsWrap.appendChild(barEl);
            });

            container.appendChild(barsWrap);

            // Mount
            target.innerHTML = '';
            target.appendChild(container);
        })
        .catch(error => {
            // Handle any errors during the fetch operation
            console.error('Fetch error:', error);
        });

});

function createBarEl(bar, settings) {
    const el = document.createElement('div');
    el.style.cssText = `
        border:1px solid ${settings.colors?.borderColor || '#E1E3E5'};
        border-radius:8px;
        padding:12px;
        background:${settings.colors?.cardsBg || '#FFFFFF'};
        cursor:pointer;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        display:flex;justify-content:space-between;align-items:center;width:100%;
    `;

    // Left: title + badge + desc
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
    badge.textContent = bar.badge;
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

    // Right: price + original price
    const right = document.createElement('div');
    right.style.cssText = 'text-align:right;';

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

    content.appendChild(left);
    content.appendChild(right);
    el.appendChild(content);

    // Gift section
    if (bar.gift) {
        el.appendChild(createGiftEl(bar.gift, settings));
    }

    return el;
}

function createGiftEl(gift, settings) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        margin-top:12px;padding-top:12px;border-top:1px solid ${settings.gift?.borderColor || '#E1E3E5'};
        background:${settings.gift?.bg || '#F8F9FA'};
        border-radius:6px;padding:12px;margin:12px -12px -12px -12px;
        border-bottom-left-radius:8px;border-bottom-right-radius:8px;
    `;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';

    if (gift.imageUrl) {
        const img = document.createElement('img');
        img.src = gift.imageUrl;
        img.alt = gift.text || 'Gift';
        img.style.cssText = `
            width:${gift.imageSize || 50}px;height:${gift.imageSize || 50}px;
            object-fit:cover;border-radius:4px;border:1px solid ${settings.gift?.borderColor || '#E1E3E5'};
        `;
        row.appendChild(img);
    }

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

// Basic price helpers (replace with real product pricing if available)
function calcPrice(bar) {
    const basePrice = 22.5;
    const compare = basePrice * (bar.quantity || 1);
    if (bar.priceType === 'percentage') return compare * (1 - (bar.priceValue || 0) / 100);
    if (bar.priceType === 'amount_off') return Math.max(0, compare - (bar.priceValue || 0));
    if (bar.priceType === 'exact_price') return (bar.priceValue || 0) * (bar.quantity || 1);
    return compare;
}
function calcOriginalPrice(bar) {
    const basePrice = 22.5;
    return basePrice * (bar.quantity || 1);
}
function formatPrice(amount) {
    return `£${Number(amount || 0).toFixed(2)}`;
}