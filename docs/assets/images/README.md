# Screenshot Images

This directory holds all screenshot images used in the documentation.

## Naming Convention

Use lowercase with hyphens, e.g. `my-feature-page.png`.

## Adding a New Screenshot

1. Place the `.png` (or `.jpg`) file in this directory
2. Reference it in the relevant Markdown page:

    ```markdown
    ![Descriptive alt text](assets/images/your-filename.png)
    ```

    Paths are relative to the `docs/` folder, not this `images/` folder.

3. Add it to `screenshots.md` if it belongs in the visual tour.

## Tips for Good Screenshots

- Use a consistent window size — 1280×800 or 1440×900 works well
- Use the dark or light theme consistently across all screenshots
- Crop tightly but leave a small border so nothing is cut off
- Add a few test containers before screenshotting so the app doesn't look empty
