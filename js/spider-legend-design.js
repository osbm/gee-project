
var legend = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px 15px'
    }});
   
  // Create legend title
  var legendTitle = ui.Label({
    value: 'dNBR Sınıfları',
    style: {fontWeight: 'bold',
      // position: "top-center",
      fontSize: '18px',
      margin: '0 0 4px 0',
      padding: '0'
      }});
   
  // Add the title to the panel
  legend.add(legendTitle);
   
  // Creates and styles 1 row of the legend.
  var makeRow = function(color, name) {
   
        // Create the label that is actually the colored box.
        var colorBox = ui.Label({
          style: {
            backgroundColor: '#' + color,
            // Use padding to give the box height and width.
            padding: '8px',
            margin: '0 0 4px 0'
          }});
   
        // Create the label filled with the description text.
        var description = ui.Label({
          value: name,
          style: {margin: '0 0 4px 6px'}
        });
   
        // return the panel
        return ui.Panel({
          widgets: [colorBox, description],
          layout: ui.Panel.Layout.Flow('horizontal')
        })};
   
  //  Palette with the colors
  var palette =['7a8737', 'acbe4d', '0ae042', 'fff70b', 'ffaf38', 'ff641b', 'a41fd6', 'ffffff'];
   
  // name of the legend
  var names = ['Enhanced Regrowth, High','Enhanced Regrowth, Low','Unburned', 'Low Severity',
  'Moderate-low Severity', 'Moderate-high Severity', 'High Severity', 'NA'];
  
  var tr_names = ['Yüksek yeniden büyüme','Düşük yeniden büyüme','Yanmamış', 'Düşük Tahribat',
  'Orta-az tahribat', 'Orta-yüksek tahribat', 'Yüksek tahribat', 'Veri yok'];
   
  // Add color and and names
  for (var i = 0; i < 8; i++) {
    legend.add(makeRow(palette[i], tr_names[i]));
    }  
   
  // add legend to map (alternatively you can also print the legend to the console)
  Map.add(legend);
  
  
  print(Map.widgets())