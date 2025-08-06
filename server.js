// Import necessary modules
const express = require('express');
const fs = require('fs');
const path = require('path');

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// This is the main API endpoint that mu.chat will connect to.
app.get('/', (req, res) => {
    // Construct the full path to the data.json file
    const dataPath = path.join(__dirname, 'data.json');

    // Read the JSON data file asynchronously
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading data.json:", err);
            return res.status(500).json({ error: "Internal Server Error: Could not read data file." });
        }

        let originalItems;
        try {
            originalItems = JSON.parse(data);
        } catch (parseErr) {
            console.error("Error parsing data.json:", parseErr);
            return res.status(500).json({ error: "Internal Server Error: Malformed JSON in data file." });
        }
        
        // --- Data Transformation and Formatting ---
        // Filter out any non-product entries.
        let items = originalItems.filter(item => item.id !== undefined);

        // Map over the items to ensure the date format is correct.
        items = items.map(item => {
            const correctlyFormattedDate = new Date(item.date_modified).toISOString();
            return {
                ...item,
                date_modified: correctlyFormattedDate
            };
        });

        // --- 1. Filtering ---
        const { modified_after } = req.query;
        if (modified_after) {
            const modifiedAfterDate = new Date(modified_after);
            if (!isNaN(modifiedAfterDate.getTime())) {
                items = items.filter(item => {
                    const itemDate = new Date(item.date_modified);
                    return itemDate > modifiedAfterDate;
                });
            }
        }

        // --- Get total count AFTER filtering but BEFORE pagination ---
        const total_count = items.length;

        // --- 2. Sorting (ULTRA-ROBUST LOGIC) ---
        const { order_by = 'date_modified', order = 'desc' } = req.query;
        
        items.sort((a, b) => {
            const valA = a[order_by];
            const valB = b[order_by];

            // Handle null/undefined values by pushing them to the end of the list
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            // Use specific logic for different data types
            switch (order_by) {
                case 'price':
                    // Use simple numeric comparison for price
                    return order === 'asc' ? valA - valB : valB - valA;
                
                case 'title':
                case 'brand':
                case 'id':
                    // Use localeCompare for robust string sorting (especially for Persian)
                    if (order === 'asc') {
                        return String(valA).localeCompare(String(valB), 'fa', { sensitivity: 'base' });
                    } else {
                        return String(valB).localeCompare(String(valA), 'fa', { sensitivity: 'base' });
                    }

                case 'date_modified':
                default:
                    // Default comparison works for ISO date strings and other values
                    if (valA < valB) {
                        return order === 'asc' ? -1 : 1;
                    }
                    if (valA > valB) {
                        return order === 'asc' ? 1 : -1;
                    }
                    return 0;
            }
        });

        // --- 3. Pagination ---
        const skip = parseInt(req.query.skip, 10) || 0;
        const take = parseInt(req.query.take, 10) || 10;
        const paginatedItems = items.slice(skip, skip + take);

        // --- 4. Final Response Structure ---
        const response = {
            total_count: total_count,
            items: paginatedItems
        };

        res.status(200).json(response);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ mu.chat compatible server is running on http://localhost:${PORT}`);
});
