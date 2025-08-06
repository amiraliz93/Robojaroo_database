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

        // --- 2. Sorting (IMPROVED LOGIC) ---
        const { order_by = 'date_modified', order = 'desc' } = req.query;
        items.sort((a, b) => {
            const valA = a[order_by];
            const valB = b[order_by];

            if (valA === undefined || valB === undefined) return 0;

            // Use localeCompare for robust string sorting (especially for non-English text)
            if (typeof valA === 'string' && typeof valB === 'string') {
                if (order === 'asc') {
                    // 'fa' specifies the locale for Persian for correct sorting
                    return valA.localeCompare(valB, 'fa');
                } else {
                    return valB.localeCompare(valA, 'fa');
                }
            }

            // Fallback for numbers and other types
            if (valA < valB) {
                return order === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return order === 'asc' ? 1 : -1;
            }
            
            return 0;
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
