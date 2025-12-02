document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const themeToggle = document.getElementById('theme-toggle');
    const categoryFilters = document.querySelector('.category-filters');
    const cards = document.querySelectorAll('.card');
    const body = document.body;

    // THEME TOGGLE LOGIC
    const applyTheme = (theme) => {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggle.textContent = '☀️';
            themeToggle.title = 'Switch to dark mode';
        } else {
            body.classList.remove('light-mode');
            themeToggle.textContent = '🌙';
            themeToggle.title = 'Switch to light mode';
        }
    };

    themeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('light-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    // FILTER & SEARCH LOGIC
    let currentFilter = 'all';

    const filterAndSearchCards = () => {
        const searchTerm = searchInput.value.toLowerCase();

        cards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();
            const category = card.dataset.category;

            const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
            const matchesFilter = currentFilter === 'all' || currentFilter === category;

            const isVisible = matchesSearch && matchesFilter;

            card.style.display = isVisible ? '' : 'none';
        });
    };

    searchInput.addEventListener('input', filterAndSearchCards);

    categoryFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            categoryFilters.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentFilter = e.target.dataset.category;
            filterAndSearchCards();
        }
    });

    // Initial setup on load
    filterAndSearchCards();

    // Add event listeners to all filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Filter cards...
        });
    });
});