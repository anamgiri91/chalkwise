// CloudFront Function, viewer-request, JavaScript runtime 2.0.
// Attach only to the website distribution, never to the API or originals bucket.
// Rewrites keep the browser URL intact, so Expo resolves the actual record ID.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri === '/') {
    request.uri = '/index.html';
  } else {
    var record = uri.match(/^\/(course|lecture)\/[^/]+\/?$/);
    if (record) {
      request.uri = '/' + record[1] + '/[id].html';
    } else {
      var page = uri.replace(/\/$/, '');
      if (
        page.indexOf('.') === -1 &&
        page.indexOf('/_expo/') !== 0 &&
        page.indexOf('/assets/') !== 0
      ) {
        request.uri = page + '.html';
      }
    }
  }
  return request;
}
