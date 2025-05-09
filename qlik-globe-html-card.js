/**
 * Qlik Globe HTML Card Extension
 * A 3D globe visualization for Qlik Sense with interactive  cards
 * Enhanced with column patching to overcome the 5-column limit
 */
define([
    'qlik', 
    'jquery', 
    'text!./globeCoordinates.json', 
    './d3.v7'
], function(qlik, $, worldJson, d3) {
    'use strict';
    
    // Global namespace for extension instances
    window.qlikGlobeExtensions = window.qlikGlobeExtensions || {};

    // Add the HTML editor function to the global namespace
    window.qlikGlobeExtensions.openHtmlEditor = function(extensionId, currentTemplate, layout) {
        console.log("Opening HTML editor for extension: " + extensionId);
        
        // Check if there's already an editor open
        const existingEditor = document.querySelector('.html-editor-modal');
        if (existingEditor) {
            existingEditor.remove();
        }
        
        // Create a modern HTML editor with live preview
        const editor = createHtmlEditor(
            currentTemplate || '',
            function(newTemplate) {
                try {
                    const app = qlik.currApp();
                    if (app) {
                        app.getObject(extensionId).then(function(model) {
                            return model.getProperties();
                        }).then(function(props) {
                            if (props.props) {
                                props.props.customCardTemplate = newTemplate;
                                return app.getObject(extensionId).then(function(model) {
                                    return model.setProperties(props);
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.error("Error saving template:", e);
                }
            },
            layout // Pass layout for field detection
        );
        
        // Append the editor to the body
        document.body.appendChild(editor);
    };

    // Define the legacy function as an alias to the global function
    function qlikGlobeOpenHtmlEditor(extensionId, currentTemplate, layout) {
        window.qlikGlobeExtensions.openHtmlEditor(extensionId, currentTemplate, layout);
    }

    // Parse the world coordinates data
    const worldData = JSON.parse(worldJson);
    
    // Add CSS styles to document head
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .qv-extension-qlik-globe {
            width: 100%;
            height: 100%;
            min-height: 400px;
            position: relative;
            overflow: hidden;
        }
        .qv-extension-qlik-globe svg {
            width: 100%;
            height: 100%;
            display: block;
        }
        .zoom-button:active {
            background-color: #e6e6e6 !important;
            transform: scale(0.95);
        }
        .zoom-controls {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -khtml-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
        }
        /*  Card Styles */
        .-card {
            position: absolute;
            background-color: white;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            padding: 8px;
            pointer-events: all;
            transform: translate(-50%, -50%);
            transition: transform 0.2s ease, opacity 0.2s ease;
            z-index: 10;
            overflow: hidden;
            border: 2px solid #4477aa;
            cursor: move;
            box-sizing: border-box;
            word-wrap: break-word;
        }
        .-card.hidden {
            display: none;
        }
        .-card.highlight {
            transform: translate(-50%, -50%) scale(1.1);
            z-index: 20;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        .-card-header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: #f0f0f0;
            margin-right: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: bold;
            color: #444;
            font-size: 16px;
        }
        .-name {
            font-weight: bold;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .-details {
            font-size: 12px;
            color: #666;
        }
        .-details div {
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .-metric {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid #eee;
        }
        .-metric-value {
            font-weight: bold;
        }
        /* Loading indicator */
        .loading-indicator {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(255, 255, 255, 0.8);
            padding: 15px 25px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 100;
            text-align: center;
        }
        /* Pagination Controls */
        .pagination-controls {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 4px;
            padding: 5px 10px;
            display: flex;
            align-items: center;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .pagination-info {
            margin-right: 10px;
            font-size: 12px;
        }
        .pagination-button {
            background: white;
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 3px 8px;
            margin: 0 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .pagination-button:hover {
            background: #f0f0f0;
        }
        .pagination-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(styleElement);
    
    /**
     * Helper function to get color value from Qlik Sense color picker
     * @param {Object} colorObj - Color object from Qlik Sense
     * @param {string} defaultColor - Default color to use if no color object
     * @returns {string} Color value
     */
    function getColor(colorObj, defaultColor) {
        if (colorObj && typeof colorObj === 'object' && colorObj.color) {
            return colorObj.color;
        } else if (typeof colorObj === 'string') {
            return colorObj;
        }
        return defaultColor;
    }
// End of Part 1
    /**
     * Get dimension and measure names from the hypercube layout
     * @param {Object} layout - The Qlik Sense layout object
     * @returns {Object} Object with dimension and measure names
     */
    function getDimensionAndMeasureNames(layout) {
        const dimensionNames = [];
        const measureNames = [];
        
        // Extract dimension names
        if (layout.qHyperCube && layout.qHyperCube.qDimensionInfo) {
            layout.qHyperCube.qDimensionInfo.forEach(function(dimInfo, idx) {
                // Use the field label (if available) or qFallbackTitle as the name
                const dimName = dimInfo.qFallbackTitle;
                const dimLabel = dimInfo.qAttrExprInfo && dimInfo.qAttrExprInfo.length > 0 ? 
                                 dimInfo.qAttrExprInfo[0].qFallbackTitle : null;
                    
                dimensionNames.push({
                    index: idx,
                    name: dimName,
                    label: dimLabel || dimName,
                    // Create a safe variable name (no spaces, special chars)
                    safeKey: createSafeKey(dimName)
                });
            });
        }
        
        // Extract measure names
        if (layout.qHyperCube && layout.qHyperCube.qMeasureInfo) {
            layout.qHyperCube.qMeasureInfo.forEach(function(measureInfo, idx) {
                const measureName = measureInfo.qFallbackTitle;
                const measureLabel = measureInfo.qAttrExprInfo && measureInfo.qAttrExprInfo.length > 0 ? 
                                    measureInfo.qAttrExprInfo[0].qFallbackTitle : null;
                    
                measureNames.push({
                    index: idx,
                    name: measureName,
                    label: measureLabel || measureName,
                    // Create a safe variable name (no spaces, special chars)
                    safeKey: createSafeKey(measureName)
                });
            });
        }
        
        return {
            dimensions: dimensionNames,
            measures: measureNames
        };
    }
    
    /**
     * Creates a safe key name for use in templates from a field name
     * @param {string} name - Original field name
     * @returns {string} Safe key name with no spaces, special chars
     */
    function createSafeKey(name) {
        if (!name) return 'unknownField';
        
        // Convert to lowercase and replace spaces and special chars with underscores
        return name.toLowerCase()
                   .replace(/\s+/g, '_')               // Replace spaces with underscores
                   .replace(/[^a-z0-9_]/g, '')         // Remove any non-alphanumeric chars except underscore
                   .replace(/^[^a-z_]+/, '')           // Ensure starts with letter or underscore
                   .replace(/^$/, 'unknownField');     // Default if empty after processing
    }
    
    /**
     * Helper function to inspect hypercube structure
     * @param {Object} layout - The layout object
     */
    function inspectHypercube(layout) {
        if (!layout.qHyperCube) {
            console.error("No hypercube found in layout");
            return;
        }
        
        console.log("Hypercube structure:");
        console.log("- Dimensions:", layout.qHyperCube.qDimensionInfo.length);
        layout.qHyperCube.qDimensionInfo.forEach((dim, i) => {
            console.log(`  ${i}: ${dim.qFallbackTitle}`);
        });
        
        console.log("- Measures:", layout.qHyperCube.qMeasureInfo.length);
        
        console.log("- Data pages:", layout.qHyperCube.qDataPages.length);
        if (layout.qHyperCube.qDataPages.length > 0) {
            const page = layout.qHyperCube.qDataPages[0];
            console.log(`  Matrix: ${page.qMatrix.length} rows x ${page.qMatrix[0] ? page.qMatrix[0].length : 0} columns`);
        }
    }
    
    /**
     * Fetch all dimensions and measures data using column patches
     * This method overcomes the 5-column limit in Qlik Sense
     * 
     * @param {Object} backendApi - Backend API reference
     * @param {Object} layout - Layout object with hypercube
     * @returns {Promise<Array>} - Promise resolving to full data matrix
     */
    function fetchWithColumnPatching(backendApi, layout) {
        return new Promise((resolve, reject) => {
            try {
                // First get basic info about our data structure
                const totalDimensions = layout.qHyperCube.qDimensionInfo.length;
                const totalMeasures = layout.qHyperCube.qMeasureInfo.length;
                const totalCols = totalDimensions + totalMeasures;
                const rowCount = layout.qHyperCube.qSize.qcy;
                
                console.log(`Need to fetch ${totalCols} columns for ${rowCount} rows with column patching`);
                
                // Check if we already have initial data and how many columns we have
                let baseMatrix = [];
                let existingCols = 0;
                
                if (layout.qHyperCube.qDataPages && 
                    layout.qHyperCube.qDataPages[0] && 
                    layout.qHyperCube.qDataPages[0].qMatrix) {
                    baseMatrix = layout.qHyperCube.qDataPages[0].qMatrix;
                    existingCols = baseMatrix[0] ? baseMatrix[0].length : 0;
                    console.log(`Starting with ${baseMatrix.length} rows x ${existingCols} columns`);
                }
                
                // If we already have all columns, just return what we have
                if (existingCols >= totalCols) {
                    console.log(`Already have all ${totalCols} columns`);
                    resolve(baseMatrix);
                    return;
                }
                
                // If we don't have any data yet or need more columns, fetch them all at once
                console.log("Fetching all columns in one request");
                
                // Create a request for all data
                const request = [{
                    qTop: 0,
                    qLeft: 0,
                    qWidth: totalCols,
                    qHeight: rowCount
                }];
                
                // Request all columns at once
                backendApi.getData(request).then(dataPages => {
                    if (dataPages && dataPages[0] && dataPages[0].qMatrix) {
                        const fullData = dataPages[0].qMatrix;
                        
                        // Check if we got all columns
                        const gotColumns = fullData[0] ? fullData[0].length : 0;
                        console.log(`Fetched ${fullData.length} rows x ${gotColumns} columns at once`);
                        
                        if (gotColumns === totalCols) {
                            // We got all columns, simply return the data
                            resolve(fullData);
                        } else {
                            // We didn't get all columns, try the fallback approach
                            console.log(`Only got ${gotColumns} of ${totalCols} columns, trying fallback approach`);
                            
                            // Create an array to hold our full data
                            const patchedMatrix = [];
                            for (let i = 0; i < rowCount; i++) {
                                patchedMatrix.push(new Array(totalCols).fill(null));
                            }
                            
                            // Fill in the columns we have
                            for (let rowIdx = 0; rowIdx < fullData.length; rowIdx++) {
                                for (let colIdx = 0; colIdx < gotColumns; colIdx++) {
                                    if (rowIdx < patchedMatrix.length) {
                                        patchedMatrix[rowIdx][colIdx] = fullData[rowIdx][colIdx];
                                    }
                                }
                            }
                            
                            // For remaining columns, use simulated data based on dimension/measure info
                            for (let colIdx = gotColumns; colIdx < totalCols; colIdx++) {
                                const isInDimensions = colIdx < totalDimensions;
                                
                                // Get dimension/measure info for this column
                                let fieldName = "Unknown";
                                if (isInDimensions && layout.qHyperCube.qDimensionInfo[colIdx]) {
                                    fieldName = layout.qHyperCube.qDimensionInfo[colIdx].qFallbackTitle;
                                } else if (!isInDimensions && layout.qHyperCube.qMeasureInfo[colIdx - totalDimensions]) {
                                    fieldName = layout.qHyperCube.qMeasureInfo[colIdx - totalDimensions].qFallbackTitle;
                                }
                                
                                // Create placeholder data for this column
                                for (let rowIdx = 0; rowIdx < patchedMatrix.length; rowIdx++) {
                                    patchedMatrix[rowIdx][colIdx] = {
                                        qText: isInDimensions ? `[${fieldName}]` : "0",
                                        qNum: isInDimensions ? NaN : 0,
                                        qElemNumber: -1
                                    };
                                }
                                
                                console.log(`Added placeholder data for column ${colIdx} (${fieldName})`);
                            }
                            
                            resolve(patchedMatrix);
                        }
                    } else {
                        console.warn("No data returned from full-width request");
                        resolve(baseMatrix); // Return whatever we have
                    }
                }).catch(error => {
                    console.error("Error fetching full data:", error);
                    
                    // Still return what we have
                    resolve(baseMatrix);
                });
            } catch (err) {
                console.error("Error in column patching:", err);
                reject(err);
            }
        });
    }
// End of Part 2
    /**
     * Process a batch of data rows
     * @param {Array} rows - Data rows from hypercube
     * @param {Object} fieldInfo - Information about dimensions and measures
     * @param {number} latIndex - Index of latitude dimension
     * @param {number} lngIndex - Index of longitude dimension
     * @param {number} nameIndex - Index of name dimension
     * @param {Object} storedPositions - Saved card positions
     * @returns {Array} - Processed data array
     */
    function processBatchData(rows, fieldInfo, latIndex, lngIndex, nameIndex, storedPositions) {
        console.log(`Processing ${rows.length} rows with dimensions:`, 
            fieldInfo.dimensions.map(d => d.name));
        
        // Log the width of the data rows to confirm we have all columns
        if (rows.length > 0) {
            console.log(`Row width: ${rows[0].length} columns`);
        }
        
        // Map raw data rows to our data model
        return rows.map(function(row) {
            // Safe getter for field values
            const safeGetField = (index) => {
                return (index >= 0 && index < row.length) ? row[index] : null;
            };
            
            // Get basic fields using the configured indices
            const latField = safeGetField(latIndex);
            const lngField = safeGetField(lngIndex);
            const nameField = safeGetField(nameIndex);
            
            // Skip invalid rows
            if (!latField || !lngField || !nameField) {
                console.warn("Missing required fields in row:", row);
                return null;
            }
            
            // Get values safely
            const latitude = latField ? parseFloat(latField.qNum) : NaN;
            const longitude = lngField ? parseFloat(lngField.qNum) : NaN;
            const name = nameField ? nameField.qText : 'Unknown';
            const initial = name ? name.charAt(0).toUpperCase() : '?';
            
            // Generate a unique ID
            const id = `${latitude}-${longitude}-${name}`;
            
            // Create a base result object
            const result = {
                id: id,
                latitude: latitude,
                longitude: longitude,
                name: name,
                initial: initial,
                qElemNumber: nameField ? nameField.qElemNumber : -1,
                
                // Raw dimension and measure data for advanced use
                raw: {
                    dimensions: {},
                    measures: {}
                },
                
                // Named fields collection for template access
                fields: {}
            };
            
            // Process ALL dimensions (including those beyond the first 5)
            for (let i = 0; i < fieldInfo.dimensions.length; i++) {
                const field = safeGetField(i);
                if (!field) {
                    console.log(`Missing field at index ${i}`);
                    continue;
                }
                
                // Find dimension info if available
                const dimInfo = fieldInfo.dimensions[i];
                const safeKey = dimInfo.safeKey;
                
                // Store raw value for direct access
                result.raw.dimensions[i] = {
                    text: field.qText,
                    num: field.qNum,
                    original: field
                };
                
                // Store in fields collection using safeKey
                result.fields[safeKey] = field.qText;
                
                // Also store numeric version if available
                if (field.qNum !== undefined) {
                    result.fields[safeKey + '_num'] = field.qNum;
                }
            }
            
            // First measure is used for size (if any measures exist)
            const measuresOffset = fieldInfo.dimensions.length;
            if (row.length > measuresOffset) {
                const firstMeasure = safeGetField(measuresOffset);
                if (firstMeasure) {
                    result.sizeValue = firstMeasure.qNum;
                    result.sizeText = firstMeasure.qText;
                }
            }
            
            // Apply stored position if available
            if (storedPositions[id]) {
                result.storedPosition = storedPositions[id];
            }
            
            return result;
        }).filter(function(d) {
            return d !== null && !isNaN(d.latitude) && !isNaN(d.longitude);
        });
    }
    
    /**
     * Function to reset card positions and save to Qlik properties
     * @param {object} api - The backendApi reference
     * @param {object} props - Extension properties
     * @param {array} data - Data points
     * @param {d3.selection} cards - D3 selection of cards
     * @param {function} update - Update function to refresh display
     */
    function resetCardPositions(api, props, data, cards, update) {
        // Clear stored positions
        props.cardPositions = {};
        
        // Clear manually positioned flags
        if (data) {
            data.forEach(function(d) {
                delete d.manuallyPositioned;
                delete d.storedPosition;
            });
        }
        
        // Reset card styles
        if (cards) {
            cards.each(function() {
                d3.select(this)
                    .style("transform", "translate(-50%, -50%)")
                    .style("left", "0px")
                    .style("top", "0px")
                    .style("display", "none"); 
            });
        }
        
        // Update display
        if (typeof update === 'function') {
            update();
        }
        
        // Save to properties (using passed backendApi)
        if (api) {
            api.getProperties().then(function(properties) {
                if (properties.props) {
                    properties.props.cardPositions = {};
                    api.setProperties(properties);
                }
            });
        }
    }
    
    // Enhanced templateParser with support for nested objects
    const templateParser = {
        parse: function(template, data) {
            if (!template) return '';

            // Get value from nested path (e.g., "fields.country" or "raw.dimensions.0.text")
            const getNestedValue = function(obj, path) {
                if (!path) return undefined;
                
                const parts = path.split('.');
                let current = obj;
                
                for (let i = 0; i < parts.length; i++) {
                    if (current === null || current === undefined) return undefined;
                    current = current[parts[i].trim()];
                }
                
                return current;
            };

            // Handle simple variable replacements with nested object support
            let result = template.replace(/\{\{([^#\/]+?)\}\}/g, function(match, p1) {
                const key = p1.trim();
                const value = getNestedValue(data, key);
                return value !== undefined ? value : '';
            });

            // Handle #if blocks with nested object support
            result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, function(match, condition, content) {
                const key = condition.trim();
                const value = getNestedValue(data, key);
                
                if (value) {
                    return templateParser.parse(content, data); // Process nested replacements
                }
                return '';
            });

            // Handle #each blocks for arrays
            result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, function(match, arrayPath, content) {
                const key = arrayPath.trim();
                const array = getNestedValue(data, key);
                
                if (Array.isArray(array)) {
                    return array.map(function(item, index) {
                        // Create context with special @index variable
                        const context = {
                            ...item,
                            '@index': index,
                            '@first': index === 0,
                            '@last': index === array.length - 1
                        };
                        return templateParser.parse(content, context);
                    }).join('');
                }
                return '';
            });

            return result;
        }
    };
// End of Part 3
    /**
     * Create a card HTML content with dynamic fields
     * @param {Object} d - Data point with all field information
     * @param {Object} props - Extension properties
     * @returns {string} HTML content
     */
    function createCardHtml(d, props) {
        // Create template data with everything accessible
        const templateData = {
            // Basic data
            name: d.name,
            initial: d.initial,
            
            // Include all dynamically named fields
            fields: d.fields || {},
            
            // Include raw dimension and measure data for advanced usage
            raw: d.raw || { dimensions: {}, measures: {} },
            
            // Add card size for conditional rendering
            cardSize: props.cardSize,
            
            // Control flags
            metricLabel: props.cardMetricLabel || 'Value',
            showAvatar: props.cardShowAvatar,
            showDetails: props.cardShowDetails,
            showMetrics: props.cardShowMetrics && d.sizeValue !== undefined
        };
        
        // Ensure all fields are accessible in the template
        Object.keys(d.fields).forEach(key => {
            if (!templateData.fields[key]) {
                templateData.fields[key] = d.fields[key];
            }
        });
        
        // Use custom template if enabled, otherwise use default
        if (props.useCustomTemplate && props.customCardTemplate) {
            try {
                return templateParser.parse(props.customCardTemplate, templateData);
            } catch (e) {
                console.error('Template parsing error:', e);
                // Fall back to default template
            }
        }
        
        // Default template - now using the fields collection dynamically
        let html = '<div class="-card-header">';
        
        // Add avatar if enabled
        if (props.cardShowAvatar) {
            html += `<div class="-avatar" style="background-color: ${getColor(props.cardSecondaryColor, "#f0f0f0")}">
                ${d.initial}
            </div>`;
        }
        
        // Display name field
        html += `<div class="-name">${d.name}</div>
        </div>`;
        
        // Add details dynamically from fields - limit fields for smaller cards
        if (props.cardShowDetails) {
            html += '<div class="-details">';
            
            // Get all field keys except for numeric versions
            const fieldKeys = Object.keys(d.fields).filter(key => !key.endsWith('_num'));
            
            // Skip dimensions used for coordinates and name (first 3)
            const skipBasicFields = 3;
            
            // Calculate max fields to show based on card size
            const maxDetails = 
                props.cardSize === "xx-small" ? 1 : 
                props.cardSize === "x-small" ? 2 : 
                props.cardSize === "small" ? 3 : 
                props.cardSize === "medium" ? 5 : 7;  // Increased limits
            
            let detailsAdded = 0;
            
            // Add all remaining fields up to the limit
            fieldKeys.forEach((key, index) => {
                if (index < skipBasicFields || detailsAdded >= maxDetails) {
                    return; // Skip basic fields (lat, long, name) and respect max details
                }
                
                const value = d.fields[key];
                if (value && typeof value === 'string' && value.trim() !== '') {
                    // For xx-small and x-small, show only values without labels
                    if (props.cardSize === "xx-small" || props.cardSize === "x-small") {
                        html += `<div>${value}</div>`;
                    } else {
                        // Convert field name from snake_case to Title Case for display
                        const displayName = key.split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        
                        html += `<div><strong>${displayName}:</strong> ${value}</div>`;
                    }
                    detailsAdded++;
                }
            });
            
            html += '</div>';
        }
        
        // Add metrics if enabled
        if (props.cardShowMetrics && d.sizeValue !== undefined) {
            html += `<div class="-metric">
                <span>${props.cardMetricLabel || 'Value'}:</span>
                <span class="-metric-value">${d.sizeText}</span>
            </div>`;
        }
        
        return html;
    }
    
    /**
     * Check if a point is visible on the front of the globe
     * @param {Object} d - Data point with lat/lon
     * @param {d3.geoProjection} projection - D3 geo projection
     * @returns {boolean} True if point is visible
     */
    function isPointVisible(d, projection) {
        const rotate = projection.rotate();
        const longitude = d.longitude + rotate[0];
        const latitude = d.latitude + rotate[1];
        return Math.cos(latitude * Math.PI / 180) * 
               Math.cos(longitude * Math.PI / 180) > 0;
    }
    
    /**
     * Resolve overlaps between cards
     * @param {Array} cardPositions - Array of card position objects
     * @param {number} scale - Current zoom scale
     * @param {number} cardWidth - Width of cards
     * @param {string} cardDensity - Density setting (low, medium, high)
     * @param {number} maxCardsVisible - Maximum number of cards visible
     * @returns {Array} Updated card positions
     */
    function resolveOverlaps(cardPositions, scale, cardWidth, cardDensity, maxCardsVisible) {
        // Skip overlap resolution if there are too few cards
        if (cardPositions.length < 3) return cardPositions;
        
        // Sort by priority (if available) or by random order
        cardPositions.sort(function(a, b) {
            // Manually positioned cards always have highest priority
            if (a.data.manuallyPositioned && !b.data.manuallyPositioned) return -1;
            if (!a.data.manuallyPositioned && b.data.manuallyPositioned) return 1;
            
            // Then use measure-based priority
            if (a.data.priority !== undefined && b.data.priority !== undefined) {
                return b.data.priority - a.data.priority; // Higher priority first
            }
            return 0.5 - Math.random(); // Random if no priority
        });
        
        // Density factor affects how aggressively we filter out overlapping cards
        const densityFactors = {
            low: 1.5,    // More space between cards
            medium: 1.0,  // Default
            high: 0.6     // Allow more overlap
        };
        
        const densityFactor = densityFactors[cardDensity] || densityFactors.medium;
        const cardBaseSize = cardWidth * densityFactor;
        const cardEffectiveSize = cardBaseSize / Math.max(0.5, scale); // Adjust for zoom level
        
        // Array to hold visible cards
        const visibleCards = [];
        
        // First pass: Add all manually positioned cards
        cardPositions.filter(function(card) {
            return card.data.manuallyPositioned;
        }).forEach(function(card) {
            // Mark as visible
            card.visible = true;
            visibleCards.push(card);
        });
        
        // Second pass: Add non-manually positioned cards if they don't overlap
        cardPositions.filter(function(card) {
            return !card.data.manuallyPositioned;
        }).forEach(function(card) {
            // Skip if we've reached the maximum visible cards
            if (visibleCards.length >= maxCardsVisible) {
                card.visible = false;
                return;
            }
            
            // Check if this card overlaps with any visible card
            const overlaps = visibleCards.some(function(visibleCard) {
                const dx = card.x - visibleCard.x;
                const dy = card.y - visibleCard.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return distance < cardEffectiveSize;
            });
            
            // If it doesn't overlap, add to visible cards
            if (!overlaps) {
                card.visible = true;
                visibleCards.push(card);
            } else {
                card.visible = false;
            }
        });
        
        return cardPositions;
    }
    
    /**
     * Update pagination controls
     * @param {jQuery} $container - jQuery container element
     * @param {Object} props - Extension properties
     * @param {Object} layout - Layout object
     * @param {Object} extension - Extension context
     */
    function updatePaginationControls($container, props, layout, extension) {
        // Only show pagination controls if enabled
        if (!props.enablePagination) {
            $container.hide();
            return;
        }
        
        // Get total data size info
        const totalDimensions = layout.qHyperCube.qDimensionInfo.length;
        const totalRows = layout.qHyperCube.qSize.qcy;
        const pageSize = props.pageSize || 500;
        const currentPage = props.currentPage || 0;
        const totalPages = Math.ceil(totalRows / pageSize);
        
        // Clear existing controls
        $container.empty();
        
        // Create pagination info
        const $info = $('<div>')
            .addClass('pagination-info')
            .text(`Page ${currentPage + 1} of ${totalPages || 1} (${totalRows} rows, ${totalDimensions} dimensions)`);
        
        // Create previous button
        const $prevBtn = $('<button>')
            .addClass('pagination-button')
            .text('< Prev')
            .prop('disabled', currentPage <= 0)
            .on('click', () => {
                if (currentPage > 0) {
                    changePage(layout, props, currentPage - 1, extension);
                }
            });
        
        // Create next button
        const $nextBtn = $('<button>')
            .addClass('pagination-button')
            .text('Next >')
            .prop('disabled', currentPage >= totalPages - 1)
            .on('click', () => {
                if (currentPage < totalPages - 1) {
                    changePage(layout, props, currentPage + 1, extension);
                }
            });
        
        // Create refresh button
        const $refreshBtn = $('<button>')
            .addClass('pagination-button')
            .text('↻ Refresh')
            .on('click', () => {
                refreshVisualization(layout);
            });
        
        // Append controls
        $container.append($info, $prevBtn, $nextBtn, $refreshBtn);
        
        // Show container
        $container.show();
    }
// End of Part 4
    /**
     * Change the current page
     * @param {Object} layout - Layout object
     * @param {Object} props - Extension properties
     * @param {number} newPage - New page number
     * @param {Object} extension - Extension context
     */
    function changePage(layout, props, newPage, extension) {
        // Save the new page number
        props.currentPage = newPage;
        
        // Update the backendApi request
        const backendApi = extension.backendApi;
        if (backendApi) {
            backendApi.getProperties().then(function(properties) {
                if (properties.props) {
                    properties.props.currentPage = newPage;
                    
                    // Calculate the new data fetch parameters
                    const pageSize = properties.props.pageSize || 500;
                    const totalWidth = 
                        (properties.qHyperCubeDef.qDimensions ? properties.qHyperCubeDef.qDimensions.length : 0) + 
                        (properties.qHyperCubeDef.qMeasures ? properties.qHyperCubeDef.qMeasures.length : 0);
                    
                    // Update the initial data fetch
                    properties.qHyperCubeDef.qInitialDataFetch = [{
                        qWidth: totalWidth,
                        qHeight: pageSize,
                        qTop: newPage * pageSize,
                        qLeft: 0
                    }];
                    
                    // Save properties and trigger a repaint
                    backendApi.setProperties(properties);
                }
            });
        }
    }
    
    /**
     * Force refresh the visualization
     * @param {Object} layout - Layout object
     */
    function refreshVisualization(layout) {
        const extensionId = layout.qInfo.qId;
        const extensionData = window.qlikGlobeExtensions[extensionId];
        
        if (extensionData && extensionData.repaint) {
            // Clear any cached data
            if (extensionData.cachedData) {
                delete extensionData.cachedData;
            }
            
            // Trigger a repaint
            extensionData.repaint(extensionData.element, layout);
        }
    }
    
    /**
     * Setup card dragging functionality
     * @param {d3.selection} cards - D3 selection of cards
     * @param {Object} data - Processed data points
     * @param {Object} props - Extension properties
     * @param {Object} backendApi - Backend API reference
     * @param {Object} container - Container element
     * @param {Object} rotationTimer - Rotation timer reference
     * @param {Function} startRotation - Function to start rotation
     * @returns {Array} Event listeners that were registered
     */
    function setupCardDragging(cards, data, props, backendApi, container, rotationTimer, startRotation) {
        const eventListeners = [];
        
        cards.each(function(d) {
            const element = this;
            let isDragging = false;
            let offsetX, offsetY;
            
            /**
             * Handle mouse down to start dragging
             * @param {MouseEvent} e - Mouse event
             */
            function startDrag(e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent globe dragging while dragging cards
                
                // Stop globe rotation
                if (rotationTimer) rotationTimer.stop();
                
                isDragging = true;
                
                // Calculate offset from center of card
                const rect = element.getBoundingClientRect();
                offsetX = e.clientX - (rect.left + rect.width / 2);
                offsetY = e.clientY - (rect.top + rect.height / 2);
                
                // Change cursor
                element.style.cursor = 'grabbing';
                
                // Add global event listeners
                document.addEventListener('mousemove', drag);
                document.addEventListener('mouseup', endDrag);
            }
            
            /**
             * Handle touch start for mobile
             * @param {TouchEvent} e - Touch event
             */
            function handleTouchStart(e) {
                if (e.touches.length === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Stop globe rotation
                    if (rotationTimer) rotationTimer.stop();
                    
                    isDragging = true;
                    
                    // Calculate offset from center of card
                    const rect = element.getBoundingClientRect();
                    const touch = e.touches[0];
                    offsetX = touch.clientX - (rect.left + rect.width / 2);
                    offsetY = touch.clientY - (rect.top + rect.height / 2);
                    
                    // Add global event listeners
                    document.addEventListener('touchmove', handleTouchMove);
                    document.addEventListener('touchend', handleTouchEnd);
                }
            }
            
            /**
             * Handle mouse move while dragging
             * @param {MouseEvent} e - Mouse event
             */
            function drag(e) {
                if (!isDragging) return;
                
                // Calculate position relative to container
                const containerRect = container.getBoundingClientRect();
                const x = e.clientX - containerRect.left - offsetX;
                const y = e.clientY - containerRect.top - offsetY;
                
                // Update position
                element.style.transform = 'none'; // Remove the translate(-50%, -50%)
                element.style.left = `${x}px`;
                element.style.top = `${y}px`;
                
                // Store the dragged position
                if (props.rememberCardPositions) {
                    props.cardPositions[d.id] = { x: x, y: y };
                    
                    // Mark as manually positioned
                    d.manuallyPositioned = true;
                }
            }
            
            /**
             * Handle touch move for mobile
             * @param {TouchEvent} e - Touch event
             */
            function handleTouchMove(e) {
                if (!isDragging || e.touches.length !== 1) return;
                
                const touch = e.touches[0];
                
                // Calculate position relative to container
                const containerRect = container.getBoundingClientRect();
                const x = touch.clientX - containerRect.left - offsetX;
                const y = touch.clientY - containerRect.top - offsetY;
                
                // Update position
                element.style.transform = 'none'; // Remove the translate(-50%, -50%)
                element.style.left = `${x}px`;
                element.style.top = `${y}px`;
                
                // Store the dragged position
                if (props.rememberCardPositions) {
                    props.cardPositions[d.id] = { x: x, y: y };
                    
                    // Mark as manually positioned
                    d.manuallyPositioned = true;
                }
            }
            
            /**
             * Handle mouse up to end dragging
             */
            function endDrag() {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Reset cursor
                element.style.cursor = 'move';
                
                // Remove global event listeners
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', endDrag);
                
                // Save card positions to properties if enabled
                if (props.rememberCardPositions && backendApi) {
                    // Update layout.props with the new positions
                    backendApi.getProperties().then(function(properties) {
                        if (properties.props) {
                            properties.props.cardPositions = props.cardPositions;
                            backendApi.setProperties(properties);
                        }
                    });
                }
                
                // Check if startRotation function exists before calling it
                if (typeof startRotation === 'function' && props.rotationSpeed > 0) {
                    startRotation();
                }
            }
            
            /**
             * Handle touch end for mobile
             */
            function handleTouchEnd() {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Remove global event listeners
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                
                // Save card positions to properties if enabled
                if (props.rememberCardPositions && backendApi) {
                    // Update layout.props with the new positions
                    backendApi.getProperties().then(function(properties) {
                        if (properties.props) {
                            properties.props.cardPositions = props.cardPositions;
                            backendApi.setProperties(properties);
                        }
                    });
                }
                
                // Check if startRotation function exists before calling it
                if (typeof startRotation === 'function' && props.rotationSpeed > 0) {
                    startRotation();
                }
            }
            
            // Add event listeners
            element.addEventListener('mousedown', startDrag);
            element.addEventListener('touchstart', handleTouchStart);
            
            // Store for cleanup
            eventListeners.push({
                element: element,
                type: 'mousedown',
                handler: startDrag
            });
            
            eventListeners.push({
                element: element,
                type: 'touchstart',
                handler: handleTouchStart
            });
        });
        
        return eventListeners;
    }
// End of Part 5
    /**
     * Setup globe dragging and interaction handlers with double-click/tap support
     * @param {d3.selection} svg - D3 selection of SVG element
     * @param {d3.geoProjection} projection - D3 geo projection
     * @param {function} update - Update function to refresh display
     * @param {function} startRotation - Function to start rotation
     * @param {function} stopRotation - Function to stop rotation
     * @param {object} rotationObj - Object containing rotation state
     * @param {number} dragSensitivity - Drag sensitivity multiplier
     * @param {boolean} enableMouseWheelZoom - Whether to enable wheel zoom
     * @param {function} zoomGlobe - Function to zoom the globe
     * @param {number} rotationSpeed - Globe rotation speed
     * @returns {Array} Event listeners that were registered
     */
    function setupInteractions(svg, projection, update, startRotation, stopRotation, rotationObj, dragSensitivity, enableMouseWheelZoom, zoomGlobe, rotationSpeed) {
        let isDragging = false;
        let lastPos = null;
        const eventListeners = [];
        
        // Variables for double-click/tap detection
        let lastClickTime = 0;
        const doubleClickDelay = 300; // Milliseconds to wait for a double-click/tap
        
        /**
         * Handler for clicks and taps to detect doubles
         * @param {Event} event - Mouse or touch event
         */
        function handleInteraction(event) {
            // Don't handle if on a card
            if (event.target.closest('.-card')) return;
            
            // Get current time
            const currentTime = Date.now();
            const timeDiff = currentTime - lastClickTime;
            
            // Check for double click/tap
            if (timeDiff < doubleClickDelay) {
                // Double click/tap detected!
                if (rotationObj.isRotating) {
                    // Stop rotation
                    stopRotation();
                    rotationObj.isRotating = false;
                    console.log('Double click/tap detected - stopping rotation');
                } else {
                    // Start rotation
                    startRotation();
                    rotationObj.isRotating = true;
                    console.log('Double click/tap detected - starting rotation');
                }
                
                // Reset the time to prevent triple-click from triggering
                lastClickTime = 0;
                
                // Prevent default behavior
                event.preventDefault();
                return;
            }
            
            // Store the current time for double click detection
            lastClickTime = currentTime;
        }
        
        // Globe drag handler
        svg.style("cursor", "grab")
           .on("mousedown", function(event) {
                // Don't trigger drag if on a card
                if (event.target.closest('.-card')) return;
                
                isDragging = true;
                lastPos = [event.offsetX, event.offsetY];
                
                // Stop rotation during manual drag
                stopRotation();
                
                // Change cursor
                svg.style("cursor", "grabbing");
                
                // Prevent default behavior
                event.preventDefault();
            })
           .on("mousemove", function(event) {
                if (!isDragging || !lastPos) return;
                
                // Calculate drag distance with sensitivity
                const dx = (event.offsetX - lastPos[0]) * dragSensitivity;
                const dy = (event.offsetY - lastPos[1]) * dragSensitivity;
                lastPos = [event.offsetX, event.offsetY];
                
                // Update projection rotation
                const rotate = projection.rotate();
                const k = 75 / projection.scale();
                
                projection.rotate([
                    rotate[0] + dx * k,
                    Math.max(-90, Math.min(90, rotate[1] - dy * k)),
                    rotate[2]
                ]);
                
                // Update view
                update();
                
                // Prevent default behavior
                event.preventDefault();
            })
           .on("mouseup", function() {
                if (!isDragging) return;
                
                isDragging = false;
                lastPos = null;
                
                // Reset cursor
                svg.style("cursor", "grab");
                
                // Restart rotation if it was previously rotating
                if (rotationSpeed > 0 && rotationObj.isRotating) {
                    startRotation();
                }
            })
           .on("mouseleave", function() {
                if (!isDragging) return;
                
                isDragging = false;
                lastPos = null;
                
                // Reset cursor
                svg.style("cursor", "grab");
                
                // Restart rotation if it was previously rotating
                if (rotationSpeed > 0 && rotationObj.isRotating) {
                    startRotation();
                }
            })
           .on("click", handleInteraction); // Add click handler for double-click detection
        
        // Mouse wheel zoom
        if (enableMouseWheelZoom) {
            svg.on("wheel", function(event) {
                event.preventDefault();
                
                // Stop rotation during zoom
                stopRotation();
                
                // Calculate zoom factor based on wheel delta
                const delta = -event.deltaY;
                const zoomFactor = delta > 0 ? 1.2 : 0.8;
                
                // Apply zoom
                zoomGlobe(zoomFactor);
                
                // Restart rotation after a delay if it was previously rotating
                if (rotationSpeed > 0 && rotationObj.isRotating) {
                    setTimeout(startRotation, 500);
                }
            });
        }
        
        // Touch events
        const touchHandler = {
            start: function(event) {
                // Don't trigger drag if on a card
                if (event.target.closest('.-card')) return;
                
                if (event.touches.length === 1) {
                    isDragging = true;
                    const touch = event.touches[0];
                    lastPos = [touch.clientX, touch.clientY];
                    
                    // Stop rotation
                    stopRotation();
                    
                    event.preventDefault();
                }
            },
            move: function(event) {
                if (!isDragging || !lastPos || event.touches.length !== 1) return;
                
                const touch = event.touches[0];
                
                // Calculate drag with sensitivity
                const dx = (touch.clientX - lastPos[0]) * dragSensitivity;
                const dy = (touch.clientY - lastPos[1]) * dragSensitivity;
                lastPos = [touch.clientX, touch.clientY];
                
                // Update projection
                const rotate = projection.rotate();
                const k = 75 / projection.scale();
                
                projection.rotate([
                    rotate[0] + dx * k,
                    Math.max(-90, Math.min(90, rotate[1] - dy * k)),
                    rotate[2]
                ]);
                
                update();
                event.preventDefault();
            },
            end: function(event) {
                if (!isDragging) {
                    // Handle tap detection if not dragging
                    handleInteraction(event);
                }
                
                isDragging = false;
                lastPos = null;
                
                // Restart rotation if it was previously rotating
                if (rotationSpeed > 0 && rotationObj.isRotating) {
                    startRotation();
                }
            }
        };
        
        // Add touch event listeners to SVG
        svg.node().addEventListener('touchstart', touchHandler.start, { passive: false });
        svg.node().addEventListener('touchmove', touchHandler.move, { passive: false });
        svg.node().addEventListener('touchend', touchHandler.end);
        svg.node().addEventListener('touchcancel', touchHandler.end);
        
        // Store for cleanup
        eventListeners.push(
            { element: svg.node(), type: 'touchstart', handler: touchHandler.start },
            { element: svg.node(), type: 'touchmove', handler: touchHandler.move },
            { element: svg.node(), type: 'touchend', handler: touchHandler.end },
            { element: svg.node(), type: 'touchcancel', handler: touchHandler.end }
        );
        
        return eventListeners;
    }
    
    /**
     * Create HTML editor with live preview
     * This function is used by the global openHtmlEditor function
     */
    function createHtmlEditor(initialTemplate, saveCallback, layout) {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'html-editor-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: Arial, sans-serif;
        `;

        // Create editor container
        const editorContainer = document.createElement('div');
        editorContainer.className = 'html-editor-container';
        editorContainer.style.cssText = `
            background: white;
            border-radius: 8px;
            width: 90%;
            max-width: 1200px;
            height: 80%;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
// End of Part 6
       // Create header
       const header = document.createElement('div');
       header.className = 'html-editor-header';
       header.style.cssText = `
           padding: 15px;
           background: #f0f0f0;
           border-bottom: 1px solid #ddd;
           border-radius: 8px 8px 0 0;
           display: flex;
           justify-content: space-between;
           align-items: center;
       `;
       header.innerHTML = '<h2 style="margin: 0; font-size: 18px;">HTML Card Template Editor</h2>';

       // Create close button
       const closeBtn = document.createElement('button');
       closeBtn.innerText = '×';
       closeBtn.style.cssText = `
           background: none;
           border: none;
           font-size: 24px;
           cursor: pointer;
           padding: 0 5px;
           color: #666;
       `;
       closeBtn.onclick = function() {
           modal.remove();
       };
       header.appendChild(closeBtn);

       // Create main editor area
       const editorArea = document.createElement('div');
       editorArea.className = 'html-editor-main';
       editorArea.style.cssText = `
           display: flex;
           flex: 1;
           overflow: hidden;
       `;

       // Create code editor
       const codeEditor = document.createElement('textarea');
       codeEditor.className = 'html-code-editor';
       codeEditor.style.cssText = `
           flex: 1;
           padding: 15px;
           font-family: monospace;
           font-size: 14px;
           border: none;
           resize: none;
           border-right: 1px solid #ddd;
           outline: none;
       `;
       codeEditor.value = initialTemplate || '';

       // Create preview area
       const previewContainer = document.createElement('div');
       previewContainer.className = 'preview-container';
       previewContainer.style.cssText = `
           flex: 1;
           padding: 15px;
           overflow: auto;
           display: flex;
           flex-direction: column;
       `;

       const previewLabel = document.createElement('div');
       previewLabel.innerText = 'Live Preview';
       previewLabel.style.cssText = `
           font-weight: bold;
           margin-bottom: 10px;
           color: #555;
       `;
       previewContainer.appendChild(previewLabel);

       // Create preview card
       const previewCard = document.createElement('div');
       previewCard.className = 'preview-card';
       previewCard.style.cssText = `
           background: white;
           border: 2px solid #4477aa;
           border-radius: 6px;
           padding: 8px;
           width: 150px;
           box-shadow: 0 2px 8px rgba(0,0,0,0.15);
       `;
       previewContainer.appendChild(previewCard);

       // Create footer with actions
       const footer = document.createElement('div');
       footer.className = 'html-editor-footer';
       footer.style.cssText = `
           padding: 15px;
           background: #f0f0f0;
           border-top: 1px solid #ddd;
           border-radius: 0 0 8px 8px;
           display: flex;
           justify-content: space-between;
           align-items: center;
       `;

       // Get available fields from layout
       const fieldsList = document.createElement('div');
       fieldsList.className = 'available-fields';
       fieldsList.style.cssText = `
           flex: 1;
           font-size: 12px;
           color: #666;
       `;

       // Extract field names from layout
       let fieldsHtml = '<strong>Available Fields:</strong> ';
       if (layout && layout.qHyperCube) {
           const dimensionNames = [];
           const measureNames = [];

           // Get dimension names
           if (layout.qHyperCube.qDimensionInfo) {
               layout.qHyperCube.qDimensionInfo.forEach(function(dim) {
                   const name = dim.qFallbackTitle;
                   dimensionNames.push(name);
               });
           }

           // Get measure names
           if (layout.qHyperCube.qMeasureInfo) {
               layout.qHyperCube.qMeasureInfo.forEach(function(measure) {
                   const name = measure.qFallbackTitle;
                   measureNames.push(name);
               });
           }

           // Create field names string
           if (dimensionNames.length > 0) {
               fieldsHtml += 'Dimensions: ';
               dimensionNames.forEach(function(name, i) {
                   const safeName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                   fieldsHtml += `<code>{{fields.${safeName}}}</code>${i < dimensionNames.length - 1 ? ', ' : ''}`;
               });
           }

           if (measureNames.length > 0) {
               fieldsHtml += ' | Measures: ';
               measureNames.forEach(function(name, i) {
                   const safeName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                   fieldsHtml += `<code>{{fields.${safeName}}}</code>${i < measureNames.length - 1 ? ', ' : ''}`;
               });
           }
       } else {
           fieldsHtml += 'Unable to find field information';
       }

       fieldsList.innerHTML = fieldsHtml;
       footer.appendChild(fieldsList);

       // Create save button
       const saveBtn = document.createElement('button');
       saveBtn.innerText = 'Save Template';
       saveBtn.style.cssText = `
           background: #4477aa;
           color: white;
           border: none;
           border-radius: 4px;
           padding: 8px 16px;
           cursor: pointer;
           font-size: 14px;
       `;
       saveBtn.onclick = function() {
           if (typeof saveCallback === 'function') {
               saveCallback(codeEditor.value);
           }
           modal.remove();
       };
       footer.appendChild(saveBtn);

       // Create help button 
       const helpBtn = document.createElement('button');
       helpBtn.innerText = 'Help';
       helpBtn.style.cssText = `
           background: #f8f8f8;
           border: 1px solid #ddd;
           border-radius: 4px;
           padding: 8px 16px;
           margin-right: 10px;
           cursor: pointer;
           font-size: 14px;
       `;
       helpBtn.onclick = function() {
           alert(`Template Variables:
   - {{name}} -  name
   - {{initial}} - First initial
   - {{fields.dimension_name}} - Any dimension value
   - {{fields.measure_name}} - Any measure value
   - {{raw.dimensions.0.text}} - Access dimensions by index
   - {{sizeText}} - Size metric formatted text
   - {{sizeValue}} - Size metric numeric value

   Conditionals:
   {{#if fields.your_field}}...content...{{/if}}

   Special Values:
   - {{cardSize}} - Current card size setting
   - {{metricLabel}} - Label for metrics section
   - {{showAvatar}} - Whether avatar is enabled
   - {{showDetails}} - Whether details are enabled
   - {{showMetrics}} - Whether metrics are enabled`);
       };
       footer.insertBefore(helpBtn, saveBtn);

       // Combine the elements
       editorArea.appendChild(codeEditor);
       editorArea.appendChild(previewContainer);
       editorContainer.appendChild(header);
       editorContainer.appendChild(editorArea);
       editorContainer.appendChild(footer);
       modal.appendChild(editorContainer);

       // Create a simple template parser for the preview
       const templateParser = {
           parse: function(template, data) {
               if (!template) return '';

               // Handle simple variable replacements
               let result = template.replace(/\{\{([^#\/]+?)\}\}/g, function(match, p1) {
                   const key = p1.trim();
                   if (key.indexOf('.') > -1) {
                       const parts = key.split('.');
                       let value = data;
                       for (let i = 0; i < parts.length; i++) {
                           if (value === undefined) return '';
                           value = value[parts[i]];
                       }
                       return value !== undefined ? value : '';
                   }
                   return data[key] !== undefined ? data[key] : '';
               });

               // Handle #if blocks
               result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, function(match, condition, content) {
                   const key = condition.trim();
                   let value;
                   
                   if (key.indexOf('.') > -1) {
                       const parts = key.split('.');
                       value = data;
                       for (let i = 0; i < parts.length; i++) {
                           if (value === undefined) return '';
                           value = value[parts[i]];
                       }
                   } else {
                       value = data[key];
                   }
                   
                   if (value) {
                       return templateParser.parse(content, data); // Process nested replacements
                   }
                   return '';
               });

               return result;
           }
       };

       // Set up the preview with sample data
       const sampleData = {
           name: 'John Smith',
           initial: 'J',
           cardSize: 'medium',
           metricLabel: 'Sales',
           showAvatar: true,
           showDetails: true,
           showMetrics: true,
           sizeText: '1,254,897',
           sizeValue: 1254897,
           fields: {
               title: 'Sales Director',
               company: 'Acme Inc',
               department: 'Sales',
               region: 'North America',
               country: 'United States'
           },
           raw: {
               dimensions: {
                   0: { text: '37.7749', num: 37.7749 },
                   1: { text: '-122.4194', num: -122.4194 },
                   2: { text: 'John Smith' }
               },
               measures: {
                   0: { text: '1,254,897', num: 1254897 }
               }
           }
       };

       // Update preview on typing
       function updatePreview() {
           try {
               previewCard.innerHTML = templateParser.parse(codeEditor.value, sampleData);
           } catch (e) {
               previewCard.innerHTML = '<div style="color: red;">Template Error: ' + e.message + '</div>';
           }
       }
       
       // Initial preview update
       updatePreview();

       // Set up event listener for input changes
       codeEditor.addEventListener('input', updatePreview);

       return modal;
   }
// End of Part 7
   /**
     * Render the globe visualization
     * @param {jQuery} $container - jQuery container element
     * @param {Object} layout - Layout object
     * @param {Object} props - Extension properties
     * @param {Array} data - Processed data array
     * @param {Object} fieldInfo - Information about dimensions and measures
     * @param {Object} backendApi - Backend API reference
     */
   function renderVisualization($container, layout, props, data, fieldInfo, backendApi) {
    // Store the processed data in the extension instance
    window.qlikGlobeExtensions[layout.qInfo.qId].cachedData = data;
    
    // Log the number of data points
    console.log(`Rendering globe with ${data.length} data points`);
    
    // Setup D3 visualization - container and dimensions
    const container = document.getElementById(`globe-container-${layout.qInfo.qId}`);
    const width = $container.width();
    const height = $container.height();
    const radius = Math.min(width, height) / 2.5;

    // Define zoom scales
    const minScale = radius * (props.minZoomScale || 0.5);
    const maxScale = radius * (props.maxZoomScale || 2.5);
    const defaultScale = radius * (props.initialZoom || 1.25);

    // Clear any existing SVG and card container
    d3.select(container).selectAll("svg").remove();
    d3.select(container).selectAll(".-cards-container").remove();

    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Create card container (outside SVG for HTML flexibility)
    const cardContainer = d3.select(container)
        .append("div")
        .attr("class", "-cards-container")
        .style("position", "absolute")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
        .style("overflow", "hidden");

    // Setup projection
    const projection = d3.geoOrthographic()
        .scale(defaultScale)
        .translate([width/2, height/2])
        .center([0, 0])
        .rotate([0, -25, 0]);

    // Path generator
    const path = d3.geoPath()
        .projection(projection);
        
    // Configure card size based on settings
    const cardSizeConfig = {
        "xx-small": { width: 80, maxVisible: props.cardMaxVisible * 2.5 },
        "x-small": { width: 100, maxVisible: props.cardMaxVisible * 2 },
        small: { width: 120, maxVisible: props.cardMaxVisible * 1.5 },
        medium: { width: 150, maxVisible: props.cardMaxVisible },
        large: { width: 180, maxVisible: props.cardMaxVisible * 0.7 }
    };
    
    const cardConfig = cardSizeConfig[props.cardSize] || cardSizeConfig.medium;
    const maxCardsVisible = cardConfig.maxVisible;
    const cardWidth = cardConfig.width * (props.cardScalingFactor || 1.0);
    
    // Calculate scales for sizing and prioritization
    let sizeScale, priorityScale;
    if (fieldInfo.measures.length > 0 && data.some(function(d) { 
        return d.sizeValue !== undefined; 
    })) {
        const sizeExtent = d3.extent(data, function(d) { return d.sizeValue; });
        sizeScale = d3.scaleLinear()
            .domain(sizeExtent)
            .range([props.minPointSize || 2, props.maxPointSize || 10]);
            
        // Use the same measure for priority ordering
        priorityScale = d3.scaleLinear()
            .domain(sizeExtent)
            .range([0, 1]);
    } else {
        // Random priority if no measure provided
        data.forEach(function(d) {
            d.priority = Math.random();
        });
    }

    // Draw ocean
    svg.append("circle")
        .attr("cx", width/2)
        .attr("cy", height/2)
        .attr("r", defaultScale)
        .attr("class", "ocean")
        .attr("fill", getColor(props.oceanColor, "#e6f3ff"));

    // Draw countries
    const countries = svg.append("g")
        .attr("class", "countries")
        .selectAll("path")
        .data(worldData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("fill", getColor(props.countryColor, "#d4dadc"))
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)
        .attr("d", path)
        .on("mouseover", function() {
            d3.select(this)
                .attr("fill", getColor(props.countryHoverColor, "#b8bfc2"));
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("fill", getColor(props.countryColor, "#d4dadc"));
        });

    // Add globe outline
    svg.append("circle")
        .attr("cx", width/2)
        .attr("cy", height/2)
        .attr("r", defaultScale)
        .attr("class", "outline")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 0.25);

    // Create a marker group for anchor points (small dots)
    const markerGroup = svg.append("g")
        .attr("class", "location-markers");
    
    // Add small marker points to mark locations
    const markers = markerGroup.selectAll("circle.location-marker")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "location-marker")
        .attr("r", 3)
        .attr("fill", getColor(props.cardPrimaryColor, "#4477aa"))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("pointer-events", "none");

    // Storage for dragged card positions
    if (!props.cardPositions) {
        props.cardPositions = {};
    }
    
    // Create  cards
    const cards = cardContainer.selectAll("div.-card")
        .data(data)
        .enter()
        .append("div")
        .attr("class", "-card")
        .attr("data-id", function(d) { return d.id; })
        .attr("data-size", props.cardSize)
        .style("width", `${cardWidth}px`)
        .style("max-width", `${cardWidth}px`)
        .style("min-width", "0")
        .style("border-color", getColor(props.cardPrimaryColor, "#4477aa"))
        .style("pointer-events", "all")
        .style("opacity", 0)
        .html(d => createCardHtml(d, props))
        .on("mouseenter", function() {
            d3.select(this).classed("highlight", true);
        })
        .on("mouseleave", function() {
            d3.select(this).classed("highlight", false);
        })
        .on("click", function(event, d) {
            // Handle card click - select the corresponding dimension
            if (backendApi && backendApi.selectValues) {
                // Use nameIndex for selection
                const nameElemNumber = d.qElemNumber;
                if (nameElemNumber !== undefined && nameElemNumber >= 0) {
                    backendApi.selectValues(props.dimNameIndex, [nameElemNumber], true);
                } else {
                    console.warn("Unable to find qElemNumber for name dimension. Selection may not work correctly.");
                }
            }
        });
    
    // Store for event cleanup
    let eventListeners = [];

    // Rotation state object
    const rotationObj = {
        timer: null,
        isRotating: props.rotationSpeed > 0  // Start with rotation if speed > 0
    };
    
    /**
     * Start automatic rotation of the globe
     */
    function startRotation() {
        // Stop any existing rotation
        stopRotation();
        
        if (props.rotationSpeed > 0) {
            let lastTime = Date.now();
            rotationObj.timer = d3.timer(function() {
                const currentTime = Date.now();
                const elapsed = currentTime - lastTime;
                lastTime = currentTime;

                const rotation = projection.rotate();
                projection.rotate([
                    rotation[0] + elapsed * (props.rotationSpeed / 1000),
                    rotation[1],
                    rotation[2]
                ]);
                
                update();
            });
            rotationObj.isRotating = true;
            console.log("Globe rotation started");
        }
    }
    
    /**
     * Stop automatic rotation of the globe
     */
    function stopRotation() {
        if (rotationObj.timer) {
            rotationObj.timer.stop();
            rotationObj.timer = null;
            console.log("Globe rotation stopped");
        }
    }
// End of Part 8
    // Make cards draggable if enabled
    if (props.cardsDraggable) {
        // Setup card dragging with explicitly passed startRotation function
        const cardDragListeners = setupCardDragging(
            cards, 
            data, 
            props, 
            backendApi, 
            container, 
            rotationObj.timer, 
            startRotation  // Pass the actual function reference
        );
        
        // Add to event listeners for cleanup
        eventListeners = eventListeners.concat(cardDragListeners);
    }

    // Update card and marker positions based on globe rotation
    function update() {
        // Update country paths
        countries.attr("d", path);
        
        // Array to track card positions for overlap detection
        const cardPositions = [];
        
        // Current scale for adjusting card visibility
        const currentScale = projection.scale() / radius;
        
        // Update markers and collect card positions
        markers.each(function(d, i) {
            const point = projection([d.longitude, d.latitude]);
            // Skip if projection failed
            if (!point) return;
            
            const [x, y] = point;
            // Skip if position is NaN
            if (isNaN(x) || isNaN(y)) return;
            
            const visible = isPointVisible(d, projection);
            
            // Update marker
            d3.select(this)
                .attr("transform", `translate(${x},${y})`)
                .style("display", visible ? null : "none");
            
            // Store position for card placement if visible
            if (visible) {
                // Calculate display priority if using measure
                if (sizeScale && d.sizeValue !== undefined) {
                    d.priority = priorityScale(d.sizeValue);
                }
                
                cardPositions.push({
                    x: x,
                    y: y,
                    data: d,
                    visible: true // Initially assume visible, resolve overlaps later
                });
            }
        });
        
        // Resolve overlaps between cards
        resolveOverlaps(cardPositions, currentScale, cardWidth, props.cardDensity, maxCardsVisible);
        
        // Update card positions
        cards.each(function(d, i) {
            // Find matching position data
            const posData = cardPositions.find(function(p) { 
                return p.data === d; 
            });
            
            // If no position data or not visible, hide card
            if (!posData) {
                d3.select(this)
                    .style("display", "none")
                    .style("opacity", 0);
                return;
            }
            
            // Check if card has been manually positioned
            if (d.manuallyPositioned && props.rememberCardPositions) {
                // Just make sure it's visible
                d3.select(this)
                    .style("display", null)
                    .style("opacity", 1);
                return;
            }
            
            // If card has a stored position, use that instead
            if (d.storedPosition && props.rememberCardPositions) {
                d3.select(this)
                    .style("display", null)
                    .style("opacity", 1)
                    .style("transform", "none") // Remove default centering transform
                    .style("left", `${d.storedPosition.x}px`)
                    .style("top", `${d.storedPosition.y}px`);
                
                d.manuallyPositioned = true;
                return;
            }
            
            // Position and show/hide based on overlap resolution
            if (posData.visible) {
                d3.select(this)
                    .style("display", null)
                    .style("opacity", 1)
                    .style("left", `${posData.x}px`)
                    .style("top", `${posData.y}px`)
                    .style("transform", "translate(-50%, -50%)"); // Reset to default centering
            } else {
                d3.select(this)
                    .style("display", "none")
                    .style("opacity", 0);
            }
        });
    }

    // Add zoom controls container
    const zoomControls = d3.select(`#globe-container-${layout.qInfo.qId}`)
        .append("div")
        .attr("class", "zoom-controls")
        .style("position", "absolute")
        .style("bottom", "20px")
        .style("left", "20px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "5px")
        .style("touch-action", "none")
        .style("z-index", "100"); // Ensure controls are above the globe

    // Add zoom in button
    zoomControls.append("button")
        .attr("class", "zoom-button")
        .style("padding", "8px")
        .style("width", "40px")
        .style("height", "40px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("background", "white")
        .style("cursor", "pointer")
        .style("font-size", "20px")
        .html("&plus;")
        .on("click", function() {
            const zoomSpeed = props.zoomSpeed || 1.2;
            zoomGlobe(zoomSpeed);
        });

    // Add reset view button
    zoomControls.append("button")
        .attr("class", "zoom-button")
        .style("padding", "8px")
        .style("width", "40px")
        .style("height", "40px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("background", "white")
        .style("cursor", "pointer")
        .style("font-size", "18px")
        .html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7"></path>
            <path d="M9 22V12h6v10"></path>
            </svg>`)
        .on("click", function() {
            resetView();
        });

    // Add toggle rotation button for easier access
    zoomControls.append("button")
        .attr("class", "zoom-button")
        .attr("id", `rotation-toggle-${layout.qInfo.qId}`)
        .style("padding", "8px")
        .style("width", "40px")
        .style("height", "40px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("background", "white")
        .style("cursor", "pointer")
        .style("font-size", "18px")
        .html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            ${rotationObj.isRotating ? 
                '<rect x="9" y="9" width="6" height="6"></rect>' : 
                '<polygon points="10 8 16 12 10 16 10 8"></polygon>'}
        </svg>`)
        .on("click", function() {
            // Toggle rotation state
            if (rotationObj.isRotating) {
                stopRotation();
                rotationObj.isRotating = false;
                // Update button icon to play
                d3.select(this).html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>`);
            } else {
                startRotation();
                rotationObj.isRotating = true;
                // Update button icon to pause
                d3.select(this).html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <rect x="9" y="9" width="6" height="6"></rect>
                </svg>`);
            }
        });

    // Add reset card positions button
    zoomControls.append("button")
        .attr("class", "zoom-button")
        .style("padding", "8px")
        .style("width", "40px")
        .style("height", "40px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("background", "white")
        .style("cursor", "pointer")
        .style("font-size", "18px")
        .html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <polyline points="23 20 23 14 17 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
        </svg>`)
        .style("display", props.rememberCardPositions ? "block" : "none")
        .on("click", function() {
            // Reset positions with proper backendApi reference
            resetCardPositions(backendApi, props, data, cards, update);
        });

    // Add zoom out button
    zoomControls.append("button")
        .attr("class", "zoom-button")
        .style("padding", "8px")
        .style("width", "40px")
        .style("height", "40px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("background", "white")
        .style("cursor", "pointer")
        .style("font-size", "20px")
        .html("&minus;")
        .on("click", function() {
            const zoomSpeed = layout.props.zoomSpeed || 1.2;
            zoomGlobe(1/zoomSpeed);
        });

    // Add zoom percentage indicator
    const zoomIndicator = zoomControls
    .append("div")
    .attr("class", "zoom-indicator")
    .style("text-align", "center")
    .style("margin", "5px 0")
    .style("background", "rgba(255, 255, 255, 0.7)")
    .style("padding", "2px 5px")
    .style("border-radius", "3px")
    .style("font-size", "12px");

/**
 * Update the zoom indicator with current zoom level
 * @param {number} scale - Current scale value
 */
function updateZoomIndicator(scale) {
    const percentage = Math.round((scale / radius) * 100);
    zoomIndicator.text(`${percentage}%`);
}

/**
 * Zooms the globe by the specified factor
 * @param {number} factor - Zoom factor (> 1 to zoom in, < 1 to zoom out)
 */
function zoomGlobe(factor) {
    const currentScale = projection.scale();
    let newScale = currentScale * factor;

    // Enforce zoom limits
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    // Update projection and elements
    projection.scale(newScale);

    // Update base elements
    d3.select("circle.ocean").attr("r", newScale);
    d3.select("circle.outline").attr("r", newScale);

    // Update elements
    update();

    // Update zoom indicator
    updateZoomIndicator(newScale);
}

/**
 * Reset the view to initial position and scale
 */
function resetView() {
    const initialRotation = [0, -25, 0];
    const initialScale = radius * (props.initialZoom || 1.25);

    // Stop rotation during animation
    const wasRotating = rotationObj.isRotating;
    stopRotation();

    d3.transition()
        .duration(1000)
        .ease(d3.easeCubicInOut)
        .tween("reset", function() {
            const currentRotation = projection.rotate();
            const currentScale = projection.scale();
            
            const rotationInterpolator = d3.interpolate(currentRotation, initialRotation);
            const scaleInterpolator = d3.interpolate(currentScale, initialScale);
            
            return function(t) {
                const scale = scaleInterpolator(t);
                projection.rotate(rotationInterpolator(t))
                        .scale(scale);
                
                d3.select("circle.ocean").attr("r", scale);
                d3.select("circle.outline").attr("r", scale);
                update();
                updateZoomIndicator(scale);
            };
        })
        .on("end", function() {
            // Restart rotation after animation if it was previously rotating
            if (wasRotating) {
                startRotation();
                
                // Update rotation toggle button icon
                d3.select(`#rotation-toggle-${layout.qInfo.qId}`)
                    .html(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <rect x="9" y="9" width="6" height="6"></rect>
                    </svg>`);
            }
        });
}

// Initialize interaction handlers with actual dependencies
const interactionListeners = setupInteractions(
    svg, 
    projection, 
    update,
    startRotation,
    stopRotation,
    rotationObj,
    props.dragSensitivity || 1.0, 
    props.enableMouseWheelZoom,
    zoomGlobe,
    props.rotationSpeed
);

// Add to event listeners for cleanup
eventListeners = eventListeners.concat(interactionListeners);

// Start rotation if enabled and rotationSpeed > 0
if (props.rotationSpeed > 0) {
    startRotation();
}

// Initial update to position cards
update();
updateZoomIndicator(defaultScale);

// Handle window resizing
const resizeObserver = new ResizeObserver(function() {
    // Delay to ensure container has fully resized
    setTimeout(function() {
        // Get new dimensions
        const newWidth = $container.width();
        const newHeight = $container.height();
        
        // Update SVG dimensions
        svg.attr("width", newWidth)
           .attr("height", newHeight);
        
        // Update projection center
        projection.translate([newWidth/2, newHeight/2]);
        
        // Update elements
        update();
    }, 100);
});

// Start observing for resize
resizeObserver.observe(container);

// Setup cleanup on element destruction
$container.on('$destroy', function() {
    // Stop any running animations
    stopRotation();

    // Disconnect resize observer
    resizeObserver.disconnect();

    // Remove all registered event listeners
    eventListeners.forEach(function(listener) {
        listener.element.removeEventListener(listener.type, listener.handler);
    });

    // Remove any HTML editor that might be open
    document.querySelectorAll('.html-editor-modal').forEach(function(modal) {
        modal.remove();
    });
});
}
// End of Part 9
// Main extension definition
return {
    /**
     * Initial properties of the extension
     */
    initialProperties: {
        qHyperCubeDef: {
            qDimensions: [],
            qMeasures: [],
            qInitialDataFetch: [{
                qWidth: 100, // Increased to support much more dimensions
                qHeight: 500, // Increased to fetch more rows at once
                qLeft: 0,
                qTop: 0
            }],
            qAlwaysFullyExpanded: true // Make sure data is fully expanded
        },
        props: {
            rotationSpeed: 20,
            countryColor: { color: "#d4dadc", index: -1 },
            oceanColor: { color: "#e6f3ff", index: -1 },
            cardPrimaryColor: { color: "#4477aa", index: -1 },
            cardSecondaryColor: { color: "#f0f0f0", index: -1 },
            countryHoverColor: { color: "#b8bfc2", index: -1 },
            cardSize: "medium", // small, medium, large
            cardScalingFactor: 1.0,
            cardDensity: "medium", // low, medium, high
            minZoomScale: 0.5,
            maxZoomScale: 2.5,
            initialZoom: 1.25,
            zoomSpeed: 1.2,
            cardMaxVisible: 50,
            cardShowAvatar: true,
            cardShowDetails: true,
            cardShowMetrics: true,
            cardMetricLabel: "Value",
            useCustomTemplate: false,
            openHtmlEditor: false,
            customCardTemplate: `<div class="-card-header">
{{#if showAvatar}}
<div class="-avatar">{{initial}}</div>
{{/if}}
<div class="-name">{{name}}</div>
</div>
{{#if showDetails}}
<div class="-details">
{{#if fields.title}}<div><strong>Title:</strong> {{fields.title}}</div>{{/if}}
{{#if fields.company}}<div><strong>Company:</strong> {{fields.company}}</div>{{/if}}
{{#if fields.department}}<div><strong>Department:</strong> {{fields.department}}</div>{{/if}}
{{#if fields.region}}<div><strong>Region:</strong> {{fields.region}}</div>{{/if}}
</div>
{{/if}}
{{#if showMetrics}}
<div class="-metric">
<span>{{metricLabel}}:</span>
<span class="-metric-value">{{sizeText}}</span>
</div>
{{/if}}`,
            cardsDraggable: true,
            rememberCardPositions: true,
            dragSensitivity: 1.0,
            enableMouseWheelZoom: true,
            // Legacy dimension mappings (for backward compatibility)
            dimLatitudeIndex: 0,
            dimLongitudeIndex: 1,
            dimNameIndex: 2,
            // New pagination properties
            enablePagination: true,
            pageSize: 500, 
            currentPage: 0
        }
    },
    
    /**
     * Property definitions for the extension settings panel
     */
    definition: {
        type: "items",
        component: "accordion",
        items: {
            dimensions: {
                uses: "dimensions",
                min: 3,
                max: 20 // Increased from 10 to support even more dimensions
            },
            measures: {
                uses: "measures",
                min: 0,
                max: 10 // Increased from 5 to support more measures
            },
            settings: {
                uses: "settings",
                items: {
                    dimensionMappingSettings: {
                        label: "Basic Dimension Mapping",
                        type: "items",
                        items: {
                            dimLatitudeIndex: {
                                ref: "props.dimLatitudeIndex",
                                label: "Latitude Dimension Index",
                                type: "number",
                                defaultValue: 0,
                                min: 0,
                                max: 19 // Increased max to match max dimensions
                            },
                            dimLongitudeIndex: {
                                ref: "props.dimLongitudeIndex",
                                label: "Longitude Dimension Index",
                                type: "number",
                                defaultValue: 1,
                                min: 0,
                                max: 19
                            },
                            dimNameIndex: {
                                ref: "props.dimNameIndex",
                                label: "Name Dimension Index",
                                type: "number",
                                defaultValue: 2,
                                min: 0,
                                max: 19
                            }
                        }
                    },
                    paginationSettings: {
                        label: "Pagination Settings",
                        type: "items",
                        items: {
                            enablePagination: {
                                ref: "props.enablePagination",
                                label: "Enable Data Pagination",
                                type: "boolean",
                                defaultValue: true
                            },
                            pageSize: {
                                ref: "props.pageSize",
                                label: "Page Size",
                                type: "number",
                                defaultValue: 500,
                                min: 100,
                                max: 1000,
                                step: 100,
                                show: function(data) {
                                    return data.props.enablePagination;
                                }
                            }
                        }
                    },
                    globeSettings: {
                        label: "Globe Settings",
                        type: "items",
                        items: {
                            countryColor: {
                                label: "Country Color",
                                component: "color-picker",
                                ref: "props.countryColor",
                                type: "object",
                                defaultValue: { index: -1, color: "#d4dadc" }
                            },
                            countryHoverColor: {
                                label: "Country Hover Color",
                                component: "color-picker",
                                ref: "props.countryHoverColor",
                                type: "object",
                                defaultValue: { index: -1, color: "#b8bfc2" }
                            },
                            oceanColor: {
                                label: "Ocean Color",
                                component: "color-picker",
                                ref: "props.oceanColor",
                                type: "object",
                                defaultValue: { index: -1, color: "#e6f3ff" }
                            },
                            rotationSpeed: {
                                ref: "props.rotationSpeed",
                                label: "Rotation Speed",
                                type: "number",
                                component: "slider",
                                min: 0,
                                max: 100,
                                step: 1,
                                defaultValue: 10
                            },
                            dragSensitivity: {
                                ref: "props.dragSensitivity",
                                label: "Drag Sensitivity",
                                type: "number",
                                component: "slider",
                                min: 0.1,
                                max: 2.0,
                                step: 0.1,
                                defaultValue: 1.0
                            },
                            enableMouseWheelZoom: {
                                ref: "props.enableMouseWheelZoom",
                                label: "Enable Mouse Wheel Zoom",
                                type: "boolean",
                                defaultValue: true
                            }
                        }
                    },
                    cardSettings: {
                        label: " Card Settings",
                        type: "items",
                        items: {
                            cardPrimaryColor: {
                                label: "Card Primary Color",
                                component: "color-picker",
                                ref: "props.cardPrimaryColor",
                                type: "object",
                                defaultValue: { index: -1, color: "#4477aa" }
                            },
                            cardSecondaryColor: {
                                label: "Card Avatar Color",
                                component: "color-picker",
                                ref: "props.cardSecondaryColor",
                                type: "object",
                                defaultValue: { index: -1, color: "#008936" }
                            },
                            cardSize: {
                                ref: "props.cardSize",
                                label: "Card Size",
                                type: "string",
                                component: "dropdown",
                                options: [
                                    {value: "xx-small", label: "XX-Small"},
                                    {value: "x-small", label: "X-Small"},
                                    {value: "small", label: "Small"},
                                    {value: "medium", label: "Medium"},
                                    {value: "large", label: "Large"}
                                ],
                                defaultValue: "medium"
                            },
                            cardScalingFactor: {
                                ref: "props.cardScalingFactor",
                                label: "Card Scaling Factor",
                                type: "number",
                                component: "slider",
                                min: 0.5,
                                max: 2.0,
                                step: 0.1,
                                defaultValue: 1.0
                            },
                            cardDensity: {
                                ref: "props.cardDensity",
                                label: "Card Density",
                                type: "string",
                                component: "dropdown",
                                options: [
                                    {value: "low", label: "Low (Less Overlap)"},
                                    {value: "medium", label: "Medium"},
                                    {value: "high", label: "High (More Cards)"}
                                ],
                                defaultValue: "medium"
                            },
                            cardMaxVisible: {
                                ref: "props.cardMaxVisible",
                                label: "Maximum Cards Visible",
                                type: "number",
                                component: "slider",
                                min: 10,
                                max: 100,
                                step: 5,
                                defaultValue: 50
                            },
                            cardsDraggable: {
                                ref: "props.cardsDraggable",
                                label: "Make Cards Draggable",
                                type: "boolean",
                                defaultValue: true
                            },
                            rememberCardPositions: {
                                ref: "props.rememberCardPositions",
                                label: "Remember Card Positions",
                                type: "boolean",
                                defaultValue: true,
                                show: function(data) {
                                    return data.props.cardsDraggable;
                                }
                            }
                        }
                    },
// End of Part 10
cardContentSettings: {
    label: "Card Content Settings",
    type: "items",
    items: {
        cardShowAvatar: {
            ref: "props.cardShowAvatar",
            label: "Show Avatar",
            type: "boolean",
            defaultValue: true
        },
        cardShowDetails: {
            ref: "props.cardShowDetails",
            label: "Show Details",
            type: "boolean",
            defaultValue: true
        },
        cardShowMetrics: {
            ref: "props.cardShowMetrics",
            label: "Show Metrics",
            type: "boolean",
            defaultValue: true
        },
        cardMetricLabel: {
            ref: "props.cardMetricLabel",
            label: "Metric Label",
            type: "string",
            defaultValue: "Value",
            show: function(data) {
                return data.props.cardShowMetrics;
            }
        }
    }
},
htmlTemplateSettings: {
    label: "HTML Template Settings",
    type: "items",
    items: {
        useCustomTemplate: {
            ref: "props.useCustomTemplate",
            label: "Use Custom HTML Template",
            type: "boolean",
            defaultValue: false
        },
        editHtmlTemplate: {
            label: "Edit HTML Template",
            component: "button",
            action: function(data) {
                // Get extension ID
                const extensionId = data.qInfo.qId;
                
                // Get the current template
                const currentTemplate = data.props.customCardTemplate || '';
                
                // Get the current extension instance data
                const extensionData = window.qlikGlobeExtensions[extensionId];
                const layout = extensionData ? extensionData.layout : null;
                
                // Use the globally accessible function
                window.qlikGlobeExtensions.openHtmlEditor(extensionId, currentTemplate, layout);
            },
            show: function(data) {
                return data.props.useCustomTemplate;
            }
        },
        templateInfoHeader: {
            label: "Available Template Variables",
            component: "text",
            show: function(data) {
                return data.props.useCustomTemplate;
            }
        },
        templateInfo: {
            label: `{{name}} -  name
                    {{initial}} - First initial
                    {{fields.dimension_name}} - Access any dimension by name
                    {{fields.measure_name}} - Access any measure by name
                    {{raw.dimensions.0.text}} - Access dimensions by index
                    {{#if fields.your_field}}...{{/if}} - Conditional based on field`,
            component: "text",
            show: function(data) {
                return data.props.useCustomTemplate;
            }
        }
    }
},
zoomSettings: {
    label: "Zoom Settings",
    type: "items",
    items: {
        minZoomScale: {
            ref: "props.minZoomScale",
            label: "Minimum Zoom Scale",
            type: "number",
            component: "slider",
            min: 0.1,
            max: 1,
            step: 0.1,
            defaultValue: 0.5
        },
        maxZoomScale: {
            ref: "props.maxZoomScale",
            label: "Maximum Zoom Scale",
            type: "number",
            component: "slider",
            min: 1,
            max: 50,
            step: 0.5,
            defaultValue: 2.5
        },
        initialZoom: {
            ref: "props.initialZoom",
            label: "Initial Zoom Level",
            type: "number",
            component: "slider",
            min: 0.5,
            max: 2.5,
            step: 0.1,
            defaultValue: 1.25
        },
        zoomSpeed: {
            ref: "props.zoomSpeed",
            label: "Zoom Speed Factor",
            type: "number",
            component: "slider",
            min: 1.1,
            max: 2,
            step: 0.1,
            defaultValue: 1.2
        }
    }
}
}
}
}
},

/**
* Paint function called when the extension needs to be rendered
* @param {jQuery} $element - The jQuery element to paint into
* @param {Object} layout - The layout object from Qlik
*/
paint: function($element, layout) {
try {
// Log available dimensions for debugging
inspectHypercube(layout);

// Store reference to backendApi and pass it where needed
const backendApi = this.backendApi;

// Store reference to extension elements to use later
window.qlikGlobeExtensions[layout.qInfo.qId] = window.qlikGlobeExtensions[layout.qInfo.qId] || {};
window.qlikGlobeExtensions[layout.qInfo.qId] = {
...window.qlikGlobeExtensions[layout.qInfo.qId],
element: $element,
layout: layout,
backendApi: backendApi,
repaint: this.paint.bind(this)
};

// Get properties from layout
const props = layout.props;

// Create container for the globe
const $container = $element.empty().append(`
<div class="qv-extension-qlik-globe">
<div id="globe-container-${layout.qInfo.qId}"></div>
</div>
`);

// Load saved card positions if they exist
const storedPositions = props.cardPositions || {};

// Get the dimension and measure field info for naming
const fieldInfo = getDimensionAndMeasureNames(layout);

// Get custom dimension indices from props (or use defaults)
const latIndex = props.dimLatitudeIndex !== undefined ? props.dimLatitudeIndex : 0;
const lngIndex = props.dimLongitudeIndex !== undefined ? props.dimLongitudeIndex : 1;
const nameIndex = props.dimNameIndex !== undefined ? props.dimNameIndex : 2;

// Create a progress indicator while loading data
const $loadingIndicator = $('<div>')
.addClass('loading-indicator')
.html('<div>Loading data...</div><div style="margin-top: 10px; font-size: 12px;">This may take a moment for large datasets</div>')
.appendTo($container);

// Create pagination container
const paginationContainer = $('<div>')
.addClass('pagination-controls')
.appendTo($container);
// End of Part 11
// Always use the improved fetchWithColumnPatching
fetchWithColumnPatching(backendApi, layout)
.then((patchedData) => {
    // Log what we got
    if (patchedData && patchedData.length > 0) {
        console.log(`Successfully patched data: ${patchedData.length} rows x ${patchedData[0].length} columns`);
        
        // Process data with all columns
        const processedData = processBatchData(
            patchedData, 
            fieldInfo, 
            latIndex, 
            lngIndex, 
            nameIndex, 
            storedPositions
        );
        
        // Remove loading indicator
        $loadingIndicator.remove();
        
        // Render with the full data
        renderVisualization($container, layout, props, processedData, fieldInfo, backendApi);
        
        // Update pagination controls
        updatePaginationControls(paginationContainer, props, layout, this);
    } else {
        console.warn("Column patching returned no data");
        $loadingIndicator.html('<div style="color: red;">No data available</div>');
    }
})
.catch(error => {
    console.error("Error during data processing:", error);
    $loadingIndicator.html('<div style="color: red;">Error loading data</div><div style="margin-top: 10px; font-size: 12px;">Please try refreshing the page</div>');
});

return qlik.Promise.resolve();
} catch (err) {
console.error('Error in globe visualization:', err);
return qlik.Promise.resolve();
}
},

/**
* Resize handler
* @param {jQuery} $element - The jQuery element to resize
* @param {Object} layout - The layout object from Qlik
*/
resize: function($element, layout) {
// Simply repaint on resize
this.paint($element, layout);
},

support: {
snapshot: true,
export: true,
exportData: true
}
};
}); // End of define
// End of Part 12