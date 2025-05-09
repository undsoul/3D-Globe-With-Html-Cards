# Qlik Globe HTML Card Extension

A powerful 3D globe visualization for Qlik Sense with interactive, customizable ambassador cards. This extension transforms geographical data into an engaging interactive experience, perfect for visualizing global networks, international presence, or worldwide metrics.

<video width="320" height="240" controls>
  <source src="https://github.com/username/repo/blob/main/videos/video.mp4?raw=true" type="video/mp4">
  Your browser does not support the video tag.
</video>

## Features

- **Interactive 3D Globe**: Fully rotatable, zoomable Earth visualization with customizable colors
- **Dynamic Ambassador Cards**: Display rich information cards for each location that can be dragged and positioned
- **Column Patching System**: Overcomes the standard 5-column limitation in Qlik Sense, supporting up to 20 dimensions
- **Customizable HTML Templates**: Create your own card designs with a built-in HTML editor and templating system
- **Smart Overlap Resolution**: Intelligent algorithm to prevent card overlapping with configurable density
- **Pagination Support**: Efficiently handle large datasets with built-in pagination
- **Responsive Design**: Adapts to various screen sizes and container dimensions
- **Advanced Styling Options**: Extensive customization options for colors, sizes, and interaction behaviors

## Installation

1. Download the latest release ZIP file 
2. In your Qlik Sense Management Console / Qlik cloud - admin/extensions , navigate to **Extensions**
3. Click **Import** and select the downloaded ZIP file
4. The extension will appear as "Qlik Globe HTML Card" in your visualization options

## Usage

### Basic Configuration

1. Add the extension to your Qlik Sense sheet
2. Configure the dimensions (minimum 3 required):
   - First dimension: Latitude values (numeric)
   - Second dimension: Longitude values (numeric)
   - Third dimension: Name or title for the ambassador cards
   - Additional dimensions (optional): Any further details you want to display on cards

3. Add measures (optional):
   - First measure: Used for point sizing and card prioritization
   - Additional measures: Can be displayed on cards

### Dimension Mapping

If your dimensions are in a different order, you can adjust the mapping in the extension settings:

1. Go to **Basic Dimension Mapping** in the settings panel
2. Set the appropriate indices for Latitude, Longitude, and Name dimensions

### Card Customization

Cards can be extensively customized through the settings panel:

1. **Card Size**: Choose from XX-Small to Large
2. **Card Density**: Control how many cards are visible at once
3. **Card Content**: Configure which elements appear (avatar, details, metrics)
4. **Colors**: Set primary and secondary colors for consistent branding
5. **Draggable Cards**: Enable/disable card dragging and position memory

### Custom HTML Templates

For advanced customization, you can create your own HTML templates:

1. Enable "Use Custom HTML Template" in the HTML Template Settings
2. Click "Edit HTML Template" to open the visual editor
3. Design your card using the available template variables:
   - `{{name}}` - Ambassador name
   - `{{initial}}` - First initial
   - `{{fields.dimension_name}}` - Access any dimension by name
   - `{{fields.measure_name}}` - Access any measure by name
   - `{{sizeText}}` - Formatted value of the first measure
   - Conditionals: `{{#if fields.your_field}}...content...{{/if}}`

### Globe Interaction

The globe offers several interaction methods:

- **Drag**: Click and drag to rotate the globe
- **Zoom**: Use the mouse wheel or the zoom controls
- **Double-click/tap**: Toggle automatic rotation
- **Reset view**: Return to the default view with the home button
- **Reset card positions**: Return all cards to their default positions

## Configuration Options

### Globe Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Country Color | Base color for countries | #d4dadc |
| Country Hover Color | Color when hovering over countries | #b8bfc2 |
| Ocean Color | Color for ocean areas | #e6f3ff |
| Rotation Speed | Speed of automatic rotation (0 = disabled) | 20 |
| Drag Sensitivity | Multiplier for drag interactions | 1.0 |
| Enable Mouse Wheel Zoom | Toggle mouse wheel zooming | Enabled |

### Card Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Card Primary Color | Main color for card borders | #4477aa |
| Card Secondary Color | Color for card avatars | #f0f0f0 |
| Card Size | Size preset for cards | Medium |
| Card Scaling Factor | Multiplier for card size | 1.0 |
| Card Density | Controls overlap prevention strictness | Medium |
| Maximum Cards Visible | Limit on simultaneously visible cards | 50 |
| Make Cards Draggable | Allow users to reposition cards | Enabled |
| Remember Card Positions | Persist card positions between sessions | Enabled |

### Zoom Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Minimum Zoom Scale | Lower zoom limit | 0.5 |
| Maximum Zoom Scale | Upper zoom limit | 2.5 |
| Initial Zoom Level | Starting zoom level | 1.25 |
| Zoom Speed Factor | Speed multiplier for zoom controls | 1.2 |

### Pagination Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enable Data Pagination | Toggle pagination for large datasets | Enabled |
| Page Size | Number of rows per page | 500 |

## Performance Considerations

- For optimal performance, limit the number of visible cards (30-50 recommended)
- For datasets with more than 1,000 points, enable pagination
- Card density setting affects performance - use "Low" for smoother interactions
- Custom HTML templates with complex logic may impact performance

## Browser Compatibility

- Chrome, Firefox, Safari, and Edge (latest versions)
- Requires WebGL support for 3D rendering
- Responsive on desktop and tablet devices
- Limited functionality on mobile devices

## Dependencies

The extension uses the following libraries:
- D3.js v7 for visualization and geographical projections
- jQuery for DOM manipulation

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/qlik-globe-extension/issues).
