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
        let items = originalItems.filter(item => item.id !== undefined && item.title !== undefined);

        // Map over the items to ensure the date format is correct.
        items = items.map(item => {
            // Ensure date_modified exists and is valid before converting
            const date = item.date_modified ? new Date(item.date_modified) : new Date();
            const correctlyFormattedDate = !isNaN(date) ? date.toISOString() : new Date().toISOString();
            
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

        // --- 2. Sorting (FINAL ROBUST LOGIC) ---
        const { order_by = 'date_modified', order = 'desc' } = req.query;
        
        items.sort((a, b) => {
            const field = order_by;
            const direction = order === 'asc' ? 1 : -1;

            const valA = a[field];
            const valB = b[field];

            // Handle null or undefined values by pushing them to the end
            if (valA == null) return 1;
            if (valB == null) return -1;

            // For numeric values (like price), perform a numeric sort.
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * direction;
            }
            
            // For all other types (including ISO date strings and Persian text),
            // use localeCompare which is powerful enough to handle them correctly.
            // The 'numeric: true' option helps sort string IDs like "10" and "2" correctly.
            return String(valA).localeCompare(String(valB), 'fa-IR', { numeric: true, sensitivity: 'base' }) * direction;
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
