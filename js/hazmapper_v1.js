// HazMapper v1.0 JavaScript Source Code; Release Date 19 October 2020
// Corey Scheip and Karl Wegmann, North Carolina State University
// contact: cmscheip@ncsu.edu
//
///// RESEARCH ONLY LICENSE ///// 
// HAZMAPPER
// Copyright © 2020 North Carolina State University. All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
// 1.	Redistributions and use are permitted for internal research purposes only, and commercial use is strictly prohibited under this license. Inquiries regarding commercial use or external distribution should be directed to the Office of Research Commercialization at North Carolina State University, 919-215-7199, https://research.ncsu.edu/commercialization/contact/, commercialization@ncsu.edu. 
// 2.	Commercial use means (a) the sale, lease, export, transfer or other distribution to a person or entity not party to this Research Only License for financial gain, income generation or other commercial purposes of any kind, whether direct or indirect, (b) providing a service to a person or entity not party to this Research Only License for financial gain, income generation or other commercial purposes of any kind, whether direct or indirect, and (c) research and development efforts with a goal of creating or refining products or services that will be provided, sold, leased, exported, transferred or distributed to a person or entity not party to this Research Only License for financial gain, income generation or other commercial purposes of any kind, whether direct or indirect.
// 3.	Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
// 4.	Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
// 5.	The names “North Carolina State University”, “NCSU” and any trade-name, personal name, trademark, trade device, service mark, symbol, image, icon, or any abbreviation, contraction or simulation thereof owned by North Carolina State University must not be used to endorse or promote products derived from this software without prior written permission. For written permission, please contact trademarks@ncsu.edu.
// Disclaimer: THIS SOFTWARE IS PROVIDED “AS IS” AND ANY EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL NORTH CAROLINA STATE UNIVERSITY BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
/////////////////////////////////

// Attempt to get parameters from URL
var d = {lonURL: Number(ui.url.get('lon', 0)),
        latURL: Number(ui.url.get('lat', 0)),
        zoomURL: Number(ui.url.get('zoom', 3)),
        datasetURL: Number(ui.url.get('dataset', false)),
        eventDateURL: ui.url.get('eventDate', false),
        preWindowURL: Number(ui.url.get('prewindow', false)),
        postWindowURL: Number(ui.url.get('postwindow', false)),
        maxCloudCoverURL: Number(ui.url.get('maxCloudCover', false)),
        slopeThreshURL: Number(ui.url.get('slopeThreshold', false))
}

//// For Debugging
// var dict = {key: value}
//var d = {lonURL: Number("-83.5180"),
//        latURL: Number("35.6924067"),
//        zoomURL: Number("12.5"),
//        datasetURL: Number("0"),
//        eventDateURL: "20161209",
//        preWindowURL: Number("12"),
//        postWindowURL: Number("9"),
//        maxCloudCoverURL: Number("30"),
//        slopeThreshURL: Number("0.05")
//}

// Initialize variables
var collection;
var lon;
var lat;
var zoom;
var dataset;
var eventDate;
var preWindow;
var postWindow;
var maxCloudCover;
var slopeThresh;

// Start populating lon, lat, and zoom URL tags
Map.onChangeCenter(function(coords) {
  lon = coords.lon;
  lat = coords.lat;

  ui.url.set('lon', lon)
  ui.url.set('lat', lat)
})

Map.onChangeZoom(function(zoom) {
  ui.url.set('zoom', zoom)
})

// Set up colors
var colors = {'cyan': '#24C1E0', 'transparent': '#11ffee00', 'gray': '#F8F9FA'};

// Set up styles
var TITLE_STYLE = {
  fontWeight: '100',
  fontSize: '20px',
  padding: '6px',
  color: '#616161',
  stretch: 'horizontal',
  //style: {position: 'top-left'},
  backgroundColor: colors.transparent,
};

var LABEL_STYLE = {
  fontWeight: '100',
  fontSize: '12px',
  padding: '5px',
  color: '#616161',
  stretch: 'horizontal',
  backgroundColor: colors.transparent,
};

// Rounding function
function roundNumber(num, dec) {
  return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

// Function to mask clouds for Sentinel
function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0));

  // Return the masked and scaled data, without the QA bands.
  return image.updateMask(mask).divide(10000)
      .select("B.*")
      .copyProperties(image, ["system:time_start"]);
}

// Function to mask clouds for Landsat 7/8
var maskLSclouds = function(image) {
  var scored = ee.Algorithms.Landsat.simpleCloudScore(image);
  return image.updateMask(scored.select(['cloud']).lte(Number(maxCloudCover)));
};


// Define function to add NDVI bands image collections
function addNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

function addNDVI_LS8(image) {
  var ndvi = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

function addNDVI_LS7(image) {
  var ndvi = image.normalizedDifference(['B4', 'B3']).rename('NDVI');
  return image.addBands(ndvi);
}

// Set up date slider
function updateDateSliderStart(collection) {
  // If user has already made event date, hold it
  if (eventDate) {
    var eventDateHold = eventDate;
  }
  // Now update slider start. Event date will be auto updated with this change
  var startUpdate = collection.first().date().get('year').format();
  var getCollectionStart = startUpdate.evaluate(function(d) {
    eventDateSlider.setStart(d);
    // Now, reset slider to event date
    if (eventDateHold) {
      eventDateSlider.setValue(eventDateHold)
    }
  });

}

// Define remove layer function
var removeLayer = function(name) {
  var layers = Map.layers();
  // list of layers names
  var names = [];
  layers.forEach(function(lay) {
    var lay_name = lay.getName();
    names.push(lay_name);
  });
  // get index
  var index = names.indexOf(name);
  if (index > -1) {
    // if name in names
    var layer = layers.get(index);
    Map.remove(layer);
  } else {
    print('Layer '+name+' not found');
  }
};

///////////////////////////////////////////////////////////////

// Set up map
Map.setOptions("TERRAIN");
var layers = Map.layers();


// Create the title label.
var title = ui.Label({
  value: 'HazMapper v1.0',
  style: {fontSize: "20px", border: '1px solid black'}, 
  targetUrl: 'https://www.hazmapper.org'
});
title.style().set('position', 'top-center');
Map.add(title);

// Make UI panel
var panel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '450px',
  height: '300px',
  backgroundColor: colors.gray,
  position: 'bottom-right', 
  },
});

// Add UI panel
Map.add(panel);

// Make variable panel
var vPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {width: '460px',
  backgroundColor: colors.transparent,
  //position: 'top-center'
  },
});

// Make event date panel
var edPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical', true),
  style: {width: '150px',
  backgroundColor: colors.transparent,
  position: 'top-left'
  },
});

// Make title panel
var titlePanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {width: '400px',
  backgroundColor: colors.transparent,
  },
});

// Add title to variable panel
var titleLabel = ui.Label('Parameters', TITLE_STYLE);

// Initialize event dates
var start = null;
var now = Date.now();
var end = ee.Date(now).format();

// Set event date variables
edPanel.add(ui.Label('Select Event Date:', LABEL_STYLE));

// Run this on slider change:
var updateEventDate = function(range) {
  eventDate = range.start();
};

// User to set event date:
var eventDateSlider;
eventDateSlider = ui.DateSlider({
  start: null,
  value: null,
  period: 1,
  onChange: updateEventDate
});
edPanel.add(eventDateSlider.setValue(now));
  
// When dataset is updated, reset collection and start of event date slider
var startUpdate;
var updateDataset = function(key) {
  dataset = datasets[key];
  if (dataset === 0) {
    collection = ee.ImageCollection('COPERNICUS/S2');
    datasetScale = 10; // pixel resolution
    updateDateSliderStart(collection);
    print("Dataset updated to " + key);
  } else if (dataset === 1) {
    collection = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA');
    datasetScale = 30; // pixel resolution
    updateDateSliderStart(collection);
    print("Dataset updated to " + key);
  } else if (dataset === 2) {
    collection = ee.ImageCollection('LANDSAT/LE07/C01/T1_TOA');
    datasetScale = 30; // pixel resolution
    updateDateSliderStart(collection);
    print("Dataset updated to " + key);
  }
  
  if (v === 1) {
    downloadPanel.style().set({shown: false});
    updateMap();
  }
};

// User to select dataset
var datasets = {"Sentinel-2 (10m) 2015+": 0,
              "Landsat 8 (30m) 2014+": 1,
              "Landsat 7 (30m) 1999+": 2};
var datasetScale

var selectData = ui.Select({
  items: Object.keys(datasets),
  value: null,
  onChange: updateDataset
});

// Show/hide buttons for main panel
// Show main panel
var varShowPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal', true),
  style: {width: '160px',
  backgroundColor: colors.transparent,
  position: 'bottom-right'
  },
});

// Show examples panel
var showVariables = function() {
  panel.style().set({
    shown: true
  });
  Map.remove(varShowPanel);
};
var varShowButton = new ui.Button({
  label: 'Show Event Variables',
});
varShowPanel.add(varShowButton);

// Register the function to the button click event.
varShowButton.onClick(showVariables);
// Hide variables
var hideVariables = function() {
  panel.style().set({
    shown: false
  });
  Map.add(varShowPanel);
};
var varHideButton = new ui.Button({
  label: 'hide',
});

// Register the function to the button click event.
varHideButton.onClick(hideVariables);

// Populate variable panel title panel
titlePanel.add(titleLabel);
titlePanel.add(selectData);
titlePanel.add(varHideButton);

// Add title and hide button to example panel
panel.add(titlePanel);

// Add Event Date Panel to main panel
vPanel.add(edPanel);

// Variable label panel
var vLabelPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical', true),
  style: {width: '200px',
  backgroundColor: colors.transparent,
  position: 'top-center'
  },
});

// Variable text box panel
var ddPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical', true),
  style: {width: '70px',
  backgroundColor: colors.transparent,
  position: 'top-center'
  },
});

// Run this on selection:
var updatePreWindow = function(preMonths) {
  if (preMonths > 0) {
    preWindow = Number(preMonths);
  } else {
    selectPre.setValue('');
  }
};

var selectPre = ui.Textbox({
  style: {stretch: 'horizontal'},
  onChange: updatePreWindow
});

// Run this on selection:
var updatePostWindow = function(postMonths) {
    if (postMonths > 0) {
      postWindow = Number(postMonths);
    } else {
      selectPost.setValue('');
    }
};
var selectPost = ui.Textbox({
  style: {stretch: 'horizontal'},
  onChange: updatePostWindow
});

// Cloud cover
var updateCloudCover = function(clouds) {
  if (clouds < 101 && clouds > -1) {
    maxCloudCover = clouds;
    selectCloud.style().set('color', 'black');
  } else {
    selectCloud.setValue('');
  }
};
var selectCloud = ui.Textbox({
  style: {stretch: 'horizontal'},
  onChange: updateCloudCover
});


// Slope threshold
var updateSlopeThresh = function(slope) {
  if (slope < 91 && slope > -1) {
    slopeThresh = slope;
  } else {
    selectSlope.setValue('');
  }
};
var selectSlope = ui.Textbox({
  //placeholder: 'Slope threshold (degrees, 0-90)',
  style: {stretch: 'horizontal'},
  onChange: updateSlopeThresh
});

// Populate variable labels
vLabelPanel.add(ui.Label('Pre-event Window (months):', LABEL_STYLE));
vLabelPanel.add(ui.Label('Post-event Window (months):', LABEL_STYLE));
vLabelPanel.add(ui.Label('Max. Cloud Cover (%):', LABEL_STYLE));
vLabelPanel.add(ui.Label('Slope threshold (deg.):', LABEL_STYLE));

// Populate ddPanel
ddPanel.add(selectPre);
ddPanel.add(selectPost);
ddPanel.add(selectCloud);
ddPanel.add(selectSlope);

// Add variable panel to main panel
vPanel.add(vLabelPanel);
vPanel.add(ddPanel);

// Add variable panel to main panel
panel.add(vPanel);

// Button panel
var buttPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal', true),
  style: {width: '400px',
  backgroundColor: colors.transparent,
  position: 'bottom-center'
  },
});

//...add update map button to panel
var updateMapButton = new ui.Button({
  label: 'Update Map'
});

// Register the function to the button click event.
updateMapButton.onClick(updateMap);

// Add to panel
buttPanel.add(updateMapButton);
var downloadArgs;
var downloadArgsGeom;
var viewBounds;
var url;
// Export data function
var exportData = function() {
  print("Exporting data...");
  downloadPanel.style().set({shown: true});
  viewBounds = ee.Geometry.Rectangle(Map.getBounds());
  downloadArgs = {
    name: 'hazmapper_export',
    scale: datasetScale,
    region: viewBounds.toGeoJSONString()
  };
  downloadArgsGeom = {
    format: 'kml'
  };
  
  var rgbVisParamsExport = rgbVisParams;
  rgbVisParamsExport.palette = null;
  var ndvi1band = ndviDiff.select('NDVI').rename('rdndvi');
  var gpc3bandPre = greenestPre.visualize(rgbVisParamsExport).rename('pre_gpc_red', 'pre_gpc_green', 'pre_gpc_blue');
  var gpc3bandPost = greenestPost.visualize(rgbVisParamsExport).rename('post_gpc_red', 'post_gpc_green', 'post_gpc_blue');
  var srtmElevation = dem.rename('elevation');
  var srtmHillshade = hs.rename('hillshade');
  var srtmSlope = sl.rename('slope');
  
  // Create export images
  var exportNDVI = ndvi1band.select('rdndvi');
  var exportSRTM = srtmElevation;
  exportSRTM = exportSRTM.addBands(srtmHillshade);
  exportSRTM = exportSRTM.addBands(srtmSlope);
  
  // Handle user digitzed geometries
  if (Map.drawingTools().layers().length() > 0) {
    var features = Map.drawingTools().toFeatureCollection();
    var exportGeom = ee.FeatureCollection(features);
    urlGeom.setUrl(exportGeom.getDownloadURL(downloadArgsGeom));
    urlGeom.style().set({shown: true});
  }
  
  // Download URL links
  downloadArgs.name = 'hazmapperNDVI';
  urlNDVI.setUrl(exportNDVI.getDownloadURL(downloadArgs));
  urlNDVI.style().set({shown: true});
  downloadArgs.name = 'hazmapperGPCpre';
  urlGPCpre.setUrl(gpc3bandPre.getDownloadURL(downloadArgs));
  urlGPCpre.style().set({shown: true});
  downloadArgs.name = 'hazmapperGPCpost';
  urlGPCpost.setUrl(gpc3bandPost.getDownloadURL(downloadArgs));
  urlGPCpost.style().set({shown: true});
  //urlGPC.setUrl(exportGPC.getDownloadURL(downloadArgs));
  //urlGPC.style().set({shown: true});
  downloadArgs.name = 'hazmapperSRTM';
  urlSRTM.setUrl(exportSRTM.getDownloadURL(downloadArgs));
  urlSRTM.style().set({shown: true});
  
  ///// Will only work in GEE Code Editor:
  // getDownloadURL limit is currently 32mb, try exporting larger scenes to drive
  Export.image.toDrive({
    image: exportNDVI,
    description: 'hazmapperNDVI',
    scale: datasetScale,
    //region: viewBounds.toGeoJSONString(),
    folder: "GEE_Exports",
    fileFormat: 'GeoTIFF'
  });
  
  Export.image.toDrive({
    image: gpc3bandPre,
    description: 'hazmapperGPCpre',
    scale: datasetScale,
    //region: viewBounds.toGeoJSONString(),
    folder: "GEE_Exports",
    fileFormat: 'GeoTIFF'
  });
  
  Export.image.toDrive({
    image: gpc3bandPost,
    description: 'hazmapperGPCpost',
    scale: datasetScale,
    //region: viewBounds.toGeoJSONString(),
    folder: "GEE_Exports",
    fileFormat: 'GeoTIFF'
  });
  
  Export.image.toDrive({
    image: srtmHillshade,
    description: 'srtmHillshade',
    scale: datasetScale,
    //region: viewBounds.toGeoJSONString(),
    folder: "GEE_Exports",
    fileFormat: 'GeoTIFF'
  });
  
  Export.image.toDrive({
    image: srtmElevation,
    description: 'srtmElevation',
    scale: datasetScale,
    //region: viewBounds.toGeoJSONString(),
    folder: "GEE_Exports",
    fileFormat: 'GeoTIFF'
  });

};

// Add UI elements to the Map.
var exportDataButton = ui.Button('Download');
var urlNDVI = ui.Label('NDVI Change Image', {shown: false});
var urlGPCpre = ui.Label('Pre Image', {shown: false});
var urlGPCpost = ui.Label('Post Image', {shown: false});
var urlSRTM = ui.Label('Elevation Data', {shown: false});
var urlGeom = ui.Label('Digitized Geometries', {shown: false});
Map.onChangeBounds(function(){downloadPanel.style().set({shown: false})});

// Add to button panel
buttPanel.add(exportDataButton);

// Add Button panel to main panel
panel.add(buttPanel);


// Create download button panel, add to map on Download click
var downloadPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical', true),
  style: {width: '200px',
  backgroundColor: colors.gray,
  position: 'top-right',
  shown: false
  },
});

// Add it to map, on initial map, set to shown:false
Map.add(downloadPanel)

// Add title to panel
var downloadTitle = ui.Label('Download Links', TITLE_STYLE);
downloadPanel.add(downloadTitle);

// Add download buttons to panel
downloadPanel.add(urlNDVI);
downloadPanel.add(urlGPCpre);
downloadPanel.add(urlGPCpost);
downloadPanel.add(urlSRTM);
downloadPanel.add(urlGeom);

// Define global variables prior to initiating update map
var ndviPre;
var ndviPost;
var ndviDiff;
var v = 0;

// Create/assign the inspector label.
var insp = ui.Label({
  value: '(click anywhere for % change in NDVI)',
  style: {
    fontSize: "12px",
    border: '1px solid black',
    position: 'bottom-center'
  }, 
});
// NDVI Change function
var inspFunc = function(coords) {
  var click_point = ee.Geometry.Point(coords.lon, coords.lat);
  // Function for returning delNDVI
  var evalFunc = function(val) {
    var delNDVI = roundNumber(val.NDVI, 2);
    var latitude =  roundNumber(coords.lat, 5);
    var longitude =  roundNumber(coords.lon, 5);
    var delNDVI_text;
    if (delNDVI > 0) {
      delNDVI_text = '(' + latitude + ', ' + longitude + '), +' + delNDVI + ' %';
    } else {
      delNDVI_text = '('+ latitude + ', ' + longitude + '), ' + delNDVI + ' %';
    }

    // Update label on map
    insp.setValue(delNDVI_text)

  };
  var delNDVI = ndviDiff.reduceRegion(ee.Reducer.first(), click_point, datasetScale).evaluate(evalFunc);
};

// Symbology
// Set color palettes
var palettes = require('users/gena/packages:palettes');
var palette = palettes.misc.jet[7].reverse();
// Update symbology function
var ndviVisParams;
var rgbVisParams;
var hsVisParams;

////// In beta testing only 
//function symMinFunc(minSliderVal) {
//  // Update vis params
//  ndviVisParams.min = minSliderVal;
//  removeLayer('Relative NDVI Change (%)');
//  ndviLayer.setVisParams(ndviVisParams);
//  layers.add(ndviLayer);
//}
//function symMaxFunc(maxSliderVal) {
//  // Update vis params
//  ndviVisParams.max = maxSliderVal;
//  removeLayer('Relative NDVI Change (%)');
//  ndviLayer.setVisParams(ndviVisParams);
//  layers.add(ndviLayer);
//}
//
//// Create sliders
//var minSliderVal = ui.Slider(-100, 1, -50, 5, symMinFunc)
//var maxSliderVal = ui.Slider(0, 100, 50, 5, symMaxFunc);
//
//// Create panels
//var symPanel = ui.Panel({
//  layout: ui.Panel.Layout.flow('horizontal', true),
//  style: {width: '360px',
//  backgroundColor: colors.gray,
//  position: 'top-right'
//  },
//});
//var symLabelPanel = ui.Panel({
//  layout: ui.Panel.Layout.flow('vertical', true),
//  style: {width: '160px',
//  backgroundColor: colors.transparent,
//  },
//});
//var symSlidePanel = ui.Panel({
//  layout: ui.Panel.Layout.flow('vertical', true),
//  style: {width: '150px',
//  backgroundColor: colors.transparent,
//  },
//});
//
//// Populate panels
//symLabelPanel.add(ui.Label('Min. Vegetative Loss (%)', LABEL_STYLE));
//symLabelPanel.add(ui.Label('Max. Vegetative Gain (%)', LABEL_STYLE));
//symSlidePanel.add(minSliderVal);
//symSlidePanel.add(maxSliderVal);
//symPanel.add(symLabelPanel);
//symPanel.add(symSlidePanel);
//
////////////////////////////////////////////////

// set position of colorbar panel
var legend = ui.Panel({
  style: {
    position: 'top-left',
    padding: '8px 15px'
  }
});

// Create colorbar title
var legendTitle1 = ui.Label({
  value: 'Vegetation Change',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});

var legendTitle2 = ui.Label({
  value: '(% rdNDVI)',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});

 // Add the titles to the colorbar panel
legend.add(legendTitle1); 
legend.add(legendTitle2); 

function makeColorRamp(viz) {
  // create the colorbar image
  var lon = ee.Image.pixelLonLat().select('latitude');
  var gradient = lon.multiply((viz.max-viz.min)/100.0).add(viz.min);
  var legendImage = gradient.visualize(viz);
  
  // create text on top of legend
  var panelMax = ui.Panel({
      widgets: [
        //ui.Label(viz['max'])
        ui.Label('gain')
      ],
    });
  
  legend.add(panelMax);
    
  // create thumbnail from the image
  var thumbnail = ui.Thumbnail({
    image: legendImage, 
    params: {bbox:'0,0,10,100', dimensions:'10x100'},  
    style: {padding: '1px', position: 'bottom-center'}
  });
  
  // add the thumbnail to the legend
  legend.add(thumbnail);
  
  // create text on top of legend
  var panelMin = ui.Panel({
      widgets: [
        //ui.Label(viz['min'])
        ui.Label('loss')
      ],
    });
  
  legend.add(panelMin);
}
////////////////////////////////////////////////

// Set layers for later changes in update map
var collectionPre;
var collectionPost;
var greenestPre;
var greenestPost;
var dem;
var hs;
var sl;
var ndviLayer;

// Callback function for the update map button.
function updateMap() {
    // check counter variable (former assignment)
  if (v === 1) {
    removeLayer('Greenest Pre');
    removeLayer('Greenest Post');
    removeLayer('Hillshade');
    removeLayer('Relative NDVI Change (%)');
    insp.setValue('click anywhere for % change in NDVI)');
    downloadPanel.style().set({shown: false});
    Map.remove(legend)
  } else {
    // Add inspector
    Map.onClick(inspFunc);
    Map.add(insp);
    Map.style().set({cursor: 'crosshair'});
    // Register the function to the button click event.
    exportDataButton.onClick(exportData);
    // Add symbology slider
    // Map.add(symPanel);
  }

  
  //...assign window ranges
  var preStart = eventDate.advance(-1*preWindow, 'month');
  var postStop = eventDate.advance(postWindow, 'month');
  
  // Add DEM
  var srtm = ee.Image('USGS/SRTMGL1_003');
  dem = srtm.resample('bilinear');
  hs = ee.Terrain.hillshade(dem).resample('bilinear');
  sl = ee.Terrain.slope(dem).resample('bilinear');

  // Get all images from date ranges
  if (dataset === 0) {
    // Set collections
    collectionPre = collection
      .filterDate(preStart, eventDate)
      .map(maskS2clouds);
    collectionPost = collection
      .filterDate(eventDate, postStop)
      .map(maskS2clouds);
      
    // Greenest pixel composite - GPC
    greenestPre = collectionPre
        .map(addNDVI)
        .qualityMosaic('NDVI');
    greenestPost = collectionPost
        .map(addNDVI)
        .qualityMosaic('NDVI');
        
    // NDVI of the GPC
    ndviPre = addNDVI(greenestPre).select('NDVI');
    ndviPost = addNDVI(greenestPost).select('NDVI');
    ndviDiff = (ndviPost.subtract(ndviPre))
        .divide((ndviPost.add(ndviPre)).sqrt()).multiply(100);
  } else if (dataset === 1 || dataset === 2) {
    // Set collections
    collectionPre = collection
      .filterDate(preStart, eventDate)
      .map(maskLSclouds);
    collectionPost = collection
      .filterDate(eventDate, postStop)
      .map(maskLSclouds);
      
    if (dataset === 1) {
      // Landsat 8 GPC
      greenestPre = collectionPre
          .map(addNDVI_LS8)
          .qualityMosaic('NDVI');
      greenestPost = collectionPost
          .map(addNDVI_LS8)
          .qualityMosaic('NDVI');
    } else if (dataset === 2) {
      // Landsat 8 GPC
      greenestPre = collectionPre
          .map(addNDVI_LS7)
          .qualityMosaic('NDVI');
      greenestPost = collectionPost
          .map(addNDVI_LS7)
          .qualityMosaic('NDVI');
    }
        
    // NDVI of the GPC
    ndviPre = addNDVI_LS8(greenestPre).select('NDVI');
    ndviPost = addNDVI_LS8(greenestPost).select('NDVI');
    ndviDiff = (ndviPost.subtract(ndviPre))
        .divide(ndviPre)
        .multiply(100);   
  }
  
  // Vis params
  if (dataset === 0 || dataset === 1) {
    rgbVisParams = {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3};
  } else if (dataset === 2) {
    rgbVisParams = {bands: ['B3', 'B2', 'B1'], min: 0, max: 0.3};
  }
  ndviVisParams = {min: -50, max: 50, palette: palette};
  hsVisParams = {min: 0, max: 255, palette: ['black', 'white']};
//var ndviVisParams = {min: minSliderVal, max: maxSliderVal, palette: palette}
  
  // Layer setup

  if (slopeThresh > 0) {
    // Update based on slope threshold
    var constantImage = ee.Image.constant(Number(slopeThresh));
    var slopeMask = sl.gte(constantImage);
    var hsMasked = hs.mask(slopeMask);
    var greenestPreMasked = greenestPre.mask(slopeMask);
    var greenestPostMasked = greenestPost.mask(slopeMask);
    var ndviDiffMasked = ndviDiff.mask(slopeMask);
    Map.addLayer(hsMasked, hsVisParams, 'Hillshade');
    Map.addLayer(greenestPreMasked, rgbVisParams, 'Greenest Pre');
    Map.addLayer(greenestPostMasked, rgbVisParams, 'Greenest Post');
    ndviLayer = ui.Map.Layer(ndviDiffMasked, ndviVisParams, 'Relative NDVI Change (%)');
    layers.add(ndviLayer);
    
  } else {
    // Add map layers
    Map.addLayer(hs, hsVisParams, 'Hillshade');
    Map.addLayer(greenestPre, rgbVisParams, 'Greenest Pre');
    Map.addLayer(greenestPost, rgbVisParams, 'Greenest Post');
    ndviLayer = ui.Map.Layer(ndviDiff, ndviVisParams, 'Relative NDVI Change (%)');
    layers.add(ndviLayer);
  }
  
  if (v === 0) {
    makeColorRamp(ndviVisParams)
  }
  Map.add(legend)
  
  // Update URL with new parameters
  ui.url.set('dataset', dataset);
  //ui.url.set('eventDate', eventDate.format('YYYMMdd').getInfo());
  var uied = eventDate.format('YYYMMdd').getInfo(function(ed) {
    ui.url.set('eventDate', ed);
  });
  ui.url.set('prewindow', preWindow);
  ui.url.set('postwindow', postWindow);
  ui.url.set('maxCloudCover', maxCloudCover);
  ui.url.set('slopeThreshold', slopeThresh);

  // assign counter variable
  v=1;

}

// Add examples
var exPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical', true),
  style: {width: '385px',
  backgroundColor: colors.gray,
  position: 'bottom-left'
  },
});

// Add panel, set to False
Map.add(exPanel);
exPanel.style().set({
    shown: false
  });

// Title example panel
var exPanelTitle = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal', true),
  style: {width: '375px',
  backgroundColor: colors.gray,
  },
});

// Title example panel
var exTitle = ui.Label('Examples', TITLE_STYLE);
exPanelTitle.add(exTitle);

// Show/hide buttons for panel
// Show examples panel for button
var exShowPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal', true),
  style: {width: '125px',
  backgroundColor: colors.transparent,
  position: 'bottom-left'
  },
});
// Show examples
var showExamples = function() {
  exPanel.style().set({
    shown: true
  });
  Map.remove(exShowPanel);
};
var exShowButton = new ui.Button({
  label: 'Show Examples',
});
exShowPanel.add(exShowButton);

// Register the function to the button click event.
exShowButton.onClick(showExamples);

// Add show example panel
Map.add(exShowPanel);

// Hide examples
var hideExamples = function() {
  exPanel.style().set({
    shown: false
  });
  Map.add(exShowPanel);
};
var exHideButton = new ui.Button({
  label: 'hide',
});

// Register the function to the button click event.
exHideButton.onClick(hideExamples);
exPanelTitle.add(exHideButton);

// Add title and hide button to example panel
exPanel.add(exPanelTitle);

// Example 1. Kenya Floods and Landslides
var Kenya = function() {
  print("Taking you to Kenya...");
  eventDate = ee.Date.fromYMD(2019, 11, 23);
  var eventJSdate = new Date(eventDate.millis().getInfo());
  eventDateSlider.setValue(eventJSdate);
  preWindow = 2;
  postWindow = 0.5;
  maxCloudCover = 30;
  slopeThresh = 0;
  selectData.setValue("Sentinel-2 (10m) 2015+");
  Map.setCenter(35.43467559814451, 1.3805470504018336, 12);
  updateMap();
  hideExamples();
  // Update variables in variable panel
  selectData.setValue("Sentinel-2 (10m) 2015+");
  selectPre.setValue(preWindow.toString());
  selectPost.setValue(postWindow.toString());
  selectCloud.setValue(maxCloudCover.toString());
  selectSlope.setValue(slopeThresh);


};
//...Create Kenya button
var kenyaButton = new ui.Button({
  label: 'Ex. 1: West Pokot Co., Kenya - Nov 2019 rainfall triggered landslides',
  //style: {stretch: 'horizontal'}
});
// Register the function to the button click event.
kenyaButton.onClick(Kenya);

// Example 2. Papua New Guinea seismically triggered slides
var PNG = function() {
  print("Taking you to Papua New Guinea...");
  eventDate = ee.Date.fromYMD(2018, 2, 25);
  var eventJSdate = new Date(eventDate.millis().getInfo());
  eventDateSlider.setValue(eventJSdate);
  preWindow = 12;
  postWindow = 9;
  maxCloudCover = 30;
  slopeThresh = 0.05;
  selectData.setValue("Sentinel-2 (10m) 2015+");
  Map.setCenter(143.0730, -6.1150, 12);
  updateMap();
  hideExamples();
  // Update variables in variable panel
  selectPre.setValue(preWindow.toString());
  selectPost.setValue(postWindow.toString());
  selectCloud.setValue(maxCloudCover.toString());
  selectSlope.setValue(slopeThresh);

};
//...add update map button to panel
var pngButton = new ui.Button({
  label: 'Ex. 2: Papua New Guinea - Feb 2018 seismically triggered landslides',
  //style: {stretch: 'horizontal'}
});
// Register the function to the button click event.
pngButton.onClick(PNG);

// Example 3. Gatlinburg Fire
var TN = function() {
  print("Taking you to Tennessee...");
  eventDate = ee.Date.fromYMD(2016, 12, 9);
  var eventJSdate = new Date(eventDate.millis().getInfo());
  eventDateSlider.setValue(eventJSdate);
  dataset=0;
  preWindow = 12;
  postWindow = 9;
  maxCloudCover = 30;
  slopeThresh = 0;
  selectData.setValue("Sentinel-2 (10m) 2015+");
  Map.setCenter(-83.5180, 35.6924067, 12.5);
  updateMap();
  hideExamples();
  // Update variables in variable panel
  selectPre.setValue(preWindow.toString());
  selectPost.setValue(postWindow.toString());
  selectCloud.setValue(maxCloudCover.toString());
  selectSlope.setValue(slopeThresh);

};
//...add update map button to panel
var tnButton = new ui.Button({
  label: 'Ex. 3: Chimney Tops 2 Wildfire, Tennesseee, USA - Nov/Dec 2016',
  //style: {stretch: 'horizontal'}
});
// Register the function to the button click event.
tnButton.onClick(TN);

// Example 4. Volcan de Fuego
var Fuego = function() {
  print("Taking you to Guatemala...");
  eventDate = ee.Date.fromYMD(2018, 6, 3);
  var eventJSdate = new Date(eventDate.millis().getInfo());
  eventDateSlider.setValue(eventJSdate);
  preWindow = 12;
  postWindow = 3;
  maxCloudCover = 30;
  slopeThresh = 0.05;
  selectData.setValue("Landsat 8 (30m) 2014+");
  Map.setCenter(-90.8700, 14.4200, 12);
  updateMap();
  hideExamples();
  // Update variables in variable panel
  selectPre.setValue(preWindow.toString());
  selectPost.setValue(postWindow.toString());
  selectCloud.setValue(maxCloudCover.toString());
  selectSlope.setValue(slopeThresh);

};
//...add update map button to panel
var fuegoButton = new ui.Button({
  label: 'Ex. 4: Volcan de Fuego, Gautemala - June 2018 eruption',
  //style: {stretch: 'horizontal'}
});
// Register the function to the button click event.
fuegoButton.onClick(Fuego);

// Example 5. Hawaii Example
var Hawaii = function() {
  print("Taking you to Hawaii...");
  eventDate = ee.Date.fromYMD(2018, 9, 4);
  var eventJSdate = new Date(eventDate.millis().getInfo());
  eventDateSlider.setValue(eventJSdate);
  preWindow = 12;
  postWindow = 6;
  maxCloudCover = 30;
  slopeThresh = 0.05;
  selectData.setValue("Landsat 8 (30m) 2014+");
  Map.setCenter(-154.85000, 19.48000, 12.5);
  updateMap();
  hideExamples();
  // Update variables in variable panel
  selectPre.setValue(preWindow.toString());
  selectPost.setValue(postWindow.toString());
  selectCloud.setValue(maxCloudCover.toString());
  selectSlope.setValue(slopeThresh);

  Map.setOptions("SATELLITE");
  
};
//...add update map button to panel
var hawaiiButton = new ui.Button({
  label: 'Ex. 5: Kīlauea, Hawaii - May to Sept 2018 eruption',
});
// Register the function to the button click event.
hawaiiButton.onClick(Hawaii);

// Add example buttons to panel
exPanel.add(kenyaButton);
exPanel.add(pngButton);
exPanel.add(tnButton);
exPanel.add(fuegoButton);
exPanel.add(hawaiiButton);


// If event variables present, update map
// Example url: https://cmscheip.users.earthengine.app/view/hazmappertester#lon=-83.5180;lat=35.6924067;zoom=12.5;dataset=1;eventDate=20161209;prewindow=12;postwindow=9;maxCloudCover=30;slopeThreshold=0;
// Set up map according to URL parameters
if (d.lonURL.toString().length>0 && d.latURL.toString().length>0) {
  Map.setCenter(d.lonURL, d.latURL);
}
if (d.zoomURL>0) {
  Map.setZoom(d.zoomURL)
}

if (d.datasetURL.toString().length>0 && d.eventDateURL.toString().length>0 && d.preWindowURL.toString().length>0 && d.postWindowURL.toString().length>0 && d.maxCloudCoverURL.toString().length>0 && d.slopeThreshURL.toString().length>0) {
  // Update dataset
  selectData.setValue(Object.keys(datasets)[Number(d.datasetURL)]);
  
  // Update variables
  preWindow = d.preWindowURL;
  postWindow = d.postWindowURL;
  maxCloudCover = d.maxCloudCoverURL;
  slopeThresh = d.slopeThreshURL;
  // Update variables in variable panel
  selectPre.setValue(d.preWindowURL);
  selectPost.setValue(d.postWindowURL);
  selectCloud.setValue(d.maxCloudCoverURL);
  selectSlope.setValue(d.slopeThreshURL);

  // Update event date
  var year = Number(d.eventDateURL.toString().substring(0,4));
  var month = Number(d.eventDateURL.toString().substring(4,6));
  var day = Number(d.eventDateURL.toString().substring(6, 8));
  eventDate = ee.Date.fromYMD(year, month, day);
  var eds = eventDate.millis().getInfo(function(ed) {
    eventDateSlider.setValue(ed);
    updateMap();
  })
}
