import RNFetchBlob from 'rn-fetch-blob';
import createBlobRecord from './createBlobRecord';

let id = 0

export default ({ directUploadsUrl, file, headers }, onStatusChange) => {
  const taskId = ++id;
  let canceled = false;
  let task;

  const handleCancel = () => {
    if (!task) { return; }

    canceled = true;
    task.cancel();
  }

  const handleStatusUpdate = (data) => {
    onStatusChange({ ...data, id: taskId, cancel: handleCancel, file });
  }

  handleStatusUpdate({ status: 'waiting' });

  return new Promise(async (resolve) => {
    try {
      const blobData = await createBlobRecord({ directUploadsUrl, file, headers });
      const { url, headers: uploadHeaders } = blobData.direct_upload;

      const fileData = RNFetchBlob.wrap(file.path);

      task = RNFetchBlob.fetch('PUT', url, uploadHeaders, fileData);

      task
        .uploadProgress({ interval: 250 }, (count, total) => {
          const progress = (count / total) * 100
          handleStatusUpdate({ status: 'progress', progress, total, count });
        })
        .then((response) => {
          const status = response.info().status;
          if (status >= 200 && status < 400) {
            handleStatusUpdate({ status: 'finished', response });
          } else {
            handleStatusUpdate({ status: 'error', response });
          }

          resolve(blobData)
        })
        .catch((error) => {
          if (canceled) {
            handleStatusUpdate({ status: 'canceled', error });
          } else {
            handleStatusUpdate({ status: 'error', error });
          }

          resolve()
        });
    } catch (error) {
      handleStatusUpdate({ status: 'error', error });
      resolve();
    }
  });
};
