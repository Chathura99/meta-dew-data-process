import React, { Component } from 'react';
import * as XLSX from 'xlsx';
import './App.css';
class App extends Component {
  constructor() {
    super();
    this.state = {
      uploadedData: null,
      processedData: null,
      isProcessedDataVisible: false,
      isUploadedDataVisible: false,
      reportHistory: [],
      historyPage: 1,
    };
  }

  historyItemsPerPage = 10;

  componentDidMount() {
    this.loadReportHistory();
  }

  getHistoryStorageKey() {
    return 'meta-dew-generated-report-history';
  }

  loadReportHistory = () => {
    try {
      const storedHistory = localStorage.getItem(this.getHistoryStorageKey());
      if (!storedHistory) {
        return;
      }
      const parsedHistory = JSON.parse(storedHistory);
      if (Array.isArray(parsedHistory)) {
        this.setState({ reportHistory: parsedHistory });
      }
    } catch (error) {
      console.error('Unable to load report history:', error);
    }
  };

  saveReportHistory = (history) => {
    try {
      localStorage.setItem(this.getHistoryStorageKey(), JSON.stringify(history));
    } catch (error) {
      console.error('Unable to save report history:', error);
    }
  };

  createTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  };

  addToReportHistory = (rows, fileName) => {
    const newEntry = {
      id: Date.now(),
      fileName,
      generatedAt: new Date().toISOString(),
      rows,
    };

    this.setState((prevState) => {
      const updatedHistory = [newEntry, ...prevState.reportHistory].slice(0, 200);
      this.saveReportHistory(updatedHistory);
      return {
        reportHistory: updatedHistory,
        historyPage: 1,
      };
    });
  };

  downloadHistoryFile = (historyItem) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(historyItem.rows), 'Processed Data');
    XLSX.writeFile(workbook, historyItem.fileName, { bookType: 'xlsx' });
  };

  formatDateTime = (isoDate) => {
    try {
      return new Date(isoDate).toLocaleString();
    } catch (error) {
      return isoDate;
    }
  };

  handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Process the sheet to consider empty cells and convert them to null
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null, // Convert empty cells to null
      });

      // Display the uploaded data in a table
      this.setState({ uploadedData: jsonData, isUploadedDataVisible: false });

      // Process your data (remove duplicates) here
      const uniqueData = this.filterDuplicateSales(jsonData);
      const timestamp = this.createTimestamp();
      const generatedFileName = `processed_data_${timestamp}.xlsx`;

      // Create a new workbook and add the processed data
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, XLSX.utils.json_to_sheet(uniqueData), 'Processed Data');

      // Generate the XLSX file as a blob for download
      XLSX.writeFile(newWorkbook, generatedFileName, { bookType: 'xlsx' });

      // Store generated report in history for later download
      this.addToReportHistory(uniqueData, generatedFileName);

      // Set the processed data in the component state
      this.setState({ processedData: newWorkbook });
    };
    reader.readAsArrayBuffer(file);
  };

  filterDuplicateSales(data) {
    var uniqueSales = new Set();
    const filteredData = [data[0]]; // Copy the first row (header) to the filtered data
    const headers = data[0] || [];

    // Initialize columns
    const cashColumn = [];
    const creditAccountColumn = [];
    const checkColumn = [];
    const bankTransferColumn = [];

    const productIdColumnIndex = headers.findIndex((header) => {
      if (header == null) {
        return false;
      }
      const normalizedHeader = String(header).trim().toLowerCase();
      return normalizedHeader === 'product id' || normalizedHeader === 'productid' || normalizedHeader === 'product_id';
    });

    const profitExists = data[0].includes('Profit');
    console.log("profitExists-->"+profitExists)

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let saleId = row[19]; // Sale ID

      // If Profit then sale ID
      // (If profit column not exists)
      // const saleId = row[17]; // Sale ID
      if(profitExists){
        saleId = row[19];
      }else{
        saleId = row[17]; // Sale ID
      }


      if (!uniqueSales.has(saleId)) {
        uniqueSales.add(saleId);

        // Payment Type
        let text = row[35];
        console.log(text);

        // If Profit then sale ID
        // (If profit column not exists)
        // Payment Type
        // const text = row[31];
        if(profitExists){
          text = row[35];
        }else{
          text = row[31];
        }

        // Use regular expressions to match and capture the values, including minus sign
        if (text != null) {
          const matches = text.match(/(Cash|Credit Account|Check|Bank Transfer): ([-]?Rs([-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?))/g);

          // Initialize variables to store the totals for each payment type
          let cashTotal = 0;
          let creditAccountTotal = 0;
          let checkTotal = 0;
          let bankTransferTotal = 0;

          if (matches) {
            for (const match of matches) {
              const [, paymentType, amount] = match.match(/(Cash|Credit Account|Check|Bank Transfer): ([-]?Rs([-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?))/);
              const parsedAmount = parseFloat(amount.replace(/[^0-9.-]/g, ''));

              if (paymentType === 'Cash') {
                cashTotal += parsedAmount;
              } else if (paymentType === 'Credit Account') {
                creditAccountTotal += parsedAmount;
              } else if (paymentType === 'Check') {
                checkTotal += parsedAmount;
              } else if (paymentType === 'Bank Transfer') {
                bankTransferTotal += parsedAmount;
              }
            }
          }

          cashColumn.push(cashTotal);
          creditAccountColumn.push(creditAccountTotal);
          checkColumn.push(checkTotal);
          bankTransferColumn.push(bankTransferTotal);
        } else {
          // Handle the case when Payment Type is null
          cashColumn.push(0);
          creditAccountColumn.push(0);
          checkColumn.push(0);
          bankTransferColumn.push(0);
        }

        filteredData.push(row);
      }
    }

    if (profitExists) {
      const newTable = filteredData.slice(1).map((row, index) => ({
        'Product id': productIdColumnIndex > -1 ? row[productIdColumnIndex] : '',
        'Sale id': row[19],
        'Date': row[21],
        'Sold to': row[25],
        'Total': row[30],
        'Profit': row[33],
        'Payment type': row[35],
        'Cash': cashColumn[index],
        'Credit Account': creditAccountColumn[index],
        'Check': checkColumn[index],
        'Bank Transfer': bankTransferColumn[index],
      }));

      // Empty row
      const emptyRow = {
        'Product id': '',
        'Sale id': '',
        'Date': '',
        'Sold to': '',
        'Total': '',
        'Profit': '',
        'Payment type': '',
        'Cash': '',
        'Credit Account': '',
        'Check': '',
        'Bank Transfer': '',
      };

      newTable.push(emptyRow);

      // Calculate the totals and append a new row with the total values
      const totalRow = {
        'Product id': 'Total',
        'Sale id': '',
        'Date': '',
        'Sold to': '',
        'Total': newTable.reduce((acc, row) => acc + parseFloat(row['Total'] || 0), 0),
        'Profit': newTable.reduce((acc, row) => acc + parseFloat(row['Profit'] || 0), 0),
        'Payment type': '',
        'Cash': newTable.reduce((acc, row) => acc + parseFloat(row['Cash'] || 0), 0),
        'Credit Account': newTable.reduce((acc, row) => acc + parseFloat(row['Credit Account'] || 0), 0),
        'Check': newTable.reduce((acc, row) => acc + parseFloat(row['Check'] || 0), 0),
        'Bank Transfer': newTable.reduce((acc, row) => acc + parseFloat(row['Bank Transfer'] || 0), 0),
      };

      newTable.push(totalRow);

      console.log(newTable);

      return newTable;
    }else{
      const newTable = filteredData.slice(1).map((row, index) => ({
        'Product id': productIdColumnIndex > -1 ? row[productIdColumnIndex] : '',
        'Sale id': row[17],
        'Date': row[19],
        'Sold to': row[23],
        'Total': row[28],
        // 'Profit': row[33],
        'Payment type': row[31],
        'Cash': cashColumn[index],
        'Credit Account': creditAccountColumn[index],
        'Check': checkColumn[index],
        'Bank Transfer': bankTransferColumn[index],
      }));
  
      // Empty row
      const emptyRow = {
        'Product id': '',
        'Sale id': '',
        'Date': '',
        'Sold to': '',
        'Total': '',
        // 'Profit': '',
        'Payment type': '',
        'Cash': '',
        'Credit Account': '',
        'Check': '',
        'Bank Transfer': '',
      };
  
      newTable.push(emptyRow);
  
      // Calculate the totals and append a new row with the total values
      const totalRow = {
        'Product id': 'Total',
        'Sale id': '',
        'Date': '',
        'Sold to': '',
        'Total': newTable.reduce((acc, row) => acc + parseFloat(row['Total'] || 0), 0),
        // 'Profit': newTable.reduce((acc, row) => acc + parseFloat(row['Profit'] || 0), 0),
        'Payment type': '',
        'Cash': newTable.reduce((acc, row) => acc + parseFloat(row['Cash'] || 0), 0),
        'Credit Account': newTable.reduce((acc, row) => acc + parseFloat(row['Credit Account'] || 0), 0),
        'Check': newTable.reduce((acc, row) => acc + parseFloat(row['Check'] || 0), 0),
        'Bank Transfer': newTable.reduce((acc, row) => acc + parseFloat(row['Bank Transfer'] || 0), 0),
      };
  
      newTable.push(totalRow);
      console.log(newTable);

      return newTable;
    }




  }
// Old version

// filterDuplicateSales(data) {
//     var uniqueSales = new Set();
//     const filteredData = [data[0]]; // Copy the first row (header) to the filtered data
  
//     // Initialize columns
//     const cashColumn = [];
//     const creditAccountColumn = [];
//     const checkColumn = [];
//     const bankTransferColumn = [];
  
//     // Check if the "Profit" column exists (for example, assume it's at index 17)
//     const profitExists = data[0].includes('Profit');
//     console.log("profitExists-->"+profitExists)
  
//     for (let i = 1; i < data.length; i++) {
//       const row = data[i];
//       const saleId = profitExists ? row[17] : row[19]; // Use "Profit" column if it exists, otherwise use "Sale ID"
  
//       if (!uniqueSales.has(saleId)) {
//         uniqueSales.add(saleId);
  
//         // Payment Type
//         const text = profitExists ? row[31] : row[35]; // Use "Profit" column if it exists, otherwise use "Payment Type"
//         console.log(text);
  
//         // Use regular expressions to match and capture the values, including minus sign
//         if (text != null) {
//           const matches = text.match(/(Cash|Credit Account|Check|Bank Transfer): ([-]?Rs([-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?))/g);
  
//           // Initialize variables to store the totals for each payment type
//           let cashTotal = 0;
//           let creditAccountTotal = 0;
//           let checkTotal = 0;
//           let bankTransferTotal = 0;
  
//           if (matches) {
//             for (const match of matches) {
//               const [, paymentType, amount] = match.match(/(Cash|Credit Account|Check|Bank Transfer): ([-]?Rs([-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?))/);
//               const parsedAmount = parseFloat(amount.replace(/[^0-9.-]/g, ''));
  
//               if (paymentType === 'Cash') {
//                 cashTotal += parsedAmount;
//               } else if (paymentType === 'Credit Account') {
//                 creditAccountTotal += parsedAmount;
//               } else if (paymentType === 'Check') {
//                 checkTotal += parsedAmount;
//               } else if (paymentType === 'Bank Transfer') {
//                 bankTransferTotal += parsedAmount;
//               }
//             }
//           }
  
//           cashColumn.push(cashTotal);
//           creditAccountColumn.push(creditAccountTotal);
//           checkColumn.push(checkTotal);
//           bankTransferColumn.push(bankTransferTotal);
//         } else {
//           // Handle the case when Payment Type is null
//           cashColumn.push(0);
//           creditAccountColumn.push(0);
//           checkColumn.push(0);
//           bankTransferColumn.push(0);
//         }
  
//         filteredData.push(row);
//       }
//     }
  
//     const newTable = filteredData.slice(1).map((row, index) => ({
//       'Product id': row[0],
//       'Sale id': profitExists ? row[17] : row[19], // Use "Profit" column if it exists, otherwise use "Sale ID"
//       'Date': row[profitExists ? 19 : 21], // Use "Profit" column if it exists, otherwise use "Date"
//       'Sold to': row[profitExists ? 23 : 25], // Use "Profit" column if it exists, otherwise use "Sold to"
//       'Total': row[profitExists ? 28 : 30], // Use "Profit" column if it exists, otherwise use "Total"
//       'Profit': profitExists ? row[33] : '', // Use "Profit" column if it exists, otherwise leave it empty
//       'Payment type': profitExists ? row[31] : row[35], // Use "Profit" column if it exists, otherwise use "Payment Type"
//       'Cash': cashColumn[index],
//       'Credit Account': creditAccountColumn[index],
//       'Check': checkColumn[index],
//       'Bank Transfer': bankTransferColumn[index],
//     }));
  
//     // Empty row
//     const emptyRow = {
//       'Product id': '',
//       'Sale id': '',
//       'Date': '',
//       'Sold to': '',
//       'Total': '',
//       'Profit': '',
//       'Payment type': '',
//       'Cash': '',
//       'Credit Account': '',
//       'Check': '',
//       'Bank Transfer': '',
//     };
  
//     newTable.push(emptyRow);
  
//     // Calculate the totals and append a new row with the total values
//     const totalRow = {
//       'Product id': 'Total',
//       'Sale id': '',
//       'Date': '',
//       'Sold to': '',
//       'Total': newTable.reduce((acc, row) => acc + parseFloat(row['Total'] || 0), 0),
//       'Profit': newTable.reduce((acc, row) => acc + parseFloat(row['Profit'] || 0), 0),
//       'Payment type': '',
//       'Cash': newTable.reduce((acc, row) => acc + parseFloat(row['Cash'] || 0), 0),
//       'Credit Account': newTable.reduce((acc, row) => acc + parseFloat(row['Credit Account'] || 0), 0),
//       'Check': newTable.reduce((acc, row) => acc + parseFloat(row['Check'] || 0), 0),
//       'Bank Transfer': newTable.reduce((acc, row) => acc + parseFloat(row['Bank Transfer'] || 0), 0),
//     };
  
//     newTable.push(totalRow);
  
//     console.log(newTable);
  
//     return newTable;
//   }

  

  toggleProcessedDataVisibility = () => {
    this.setState((prevState) => ({
      isProcessedDataVisible: !prevState.isProcessedDataVisible,
    }));
  };

  toggleUploadedDataVisibility = () => {
    this.setState((prevState) => ({
      isUploadedDataVisible: !prevState.isUploadedDataVisible,
    }));
  };

  goToPreviousHistoryPage = () => {
    this.setState((prevState) => ({
      historyPage: Math.max(1, prevState.historyPage - 1),
    }));
  };

  goToNextHistoryPage = () => {
    const totalPages = Math.max(1, Math.ceil(this.state.reportHistory.length / this.historyItemsPerPage));
    this.setState((prevState) => ({
      historyPage: Math.min(totalPages, prevState.historyPage + 1),
    }));
  };

  render() {
    const totalHistoryPages = Math.max(1, Math.ceil(this.state.reportHistory.length / this.historyItemsPerPage));
    const currentHistoryPage = Math.min(this.state.historyPage, totalHistoryPages);
    const startIndex = (currentHistoryPage - 1) * this.historyItemsPerPage;
    const endIndex = startIndex + this.historyItemsPerPage;
    const paginatedHistory = this.state.reportHistory.slice(startIndex, endIndex);

    return (
      <div className="App">
        <div className="app-shell">
          <div className="hero-card">
            <h1>Arthika Foods And Transport</h1>
            <h3>Data Processing App</h3>
            <label className="file-input-label" htmlFor="xlsx-upload">Upload Excel File</label>
            <input id="xlsx-upload" type="file" onChange={this.handleFileChange} accept=".xlsx" />
          </div>

          <div className="data-section">
          {this.state.uploadedData && (
            <div className="panel-card">
              <div className="history-section">
                <h3 className="history-title">Generated File History</h3>
                {this.state.reportHistory.length === 0 ? (
                  <p className="history-empty">No generated files yet.</p>
                ) : (
                  <>
                  <ul className="history-list">
                    {paginatedHistory.map((historyItem) => (
                      <li key={historyItem.id} className="history-item">
                        <div className="history-meta">
                          <span className="history-name">{historyItem.fileName}</span>
                          <span className="history-time">{this.formatDateTime(historyItem.generatedAt)}</span>
                        </div>
                        <button
                          type="button"
                          className="history-download-button"
                          onClick={() => this.downloadHistoryFile(historyItem)}
                        >
                          Download Again
                        </button>
                      </li>
                    ))}
                  </ul>
                  {totalHistoryPages > 1 && (
                    <div className="history-pagination">
                      <button
                        type="button"
                        className="history-page-button"
                        onClick={this.goToPreviousHistoryPage}
                        disabled={currentHistoryPage === 1}
                      >
                        Previous
                      </button>
                      <span className="history-page-info">
                        Page {currentHistoryPage} of {totalHistoryPages}
                      </span>
                      <button
                        type="button"
                        className="history-page-button"
                        onClick={this.goToNextHistoryPage}
                        disabled={currentHistoryPage === totalHistoryPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  </>
                )}
              </div>

              <button
                type="button"
                className="view-uploaded-button"
                onClick={this.toggleUploadedDataVisibility}
              >
                {this.state.isUploadedDataVisible ? 'Hide Uploaded File Data' : 'View Uploaded File Data'}
              </button>

              {this.state.isUploadedDataVisible && (
                <>
                  <h2 className="section-title">Uploaded Data</h2>
                  <DataTable data={this.state.uploadedData} />
                </>
              )}
            </div>
          )}
          </div>

          <div className="data-section">
          {this.state.isProcessedDataVisible && this.state.processedData && (
            <div className="panel-card">
              <h2 className="section-title">Processed Data</h2>
              <DataTable data={XLSX.utils.sheet_to_json(this.state.processedData.Sheets['Processed Data'], { header: 1 })} />
              <a
                className="download-button"
                href={URL.createObjectURL(this.state.processedData)}
                download="processed_data.xlsx"
              >
                Download Processed Data
              </a>
            </div>
          )}
          </div>

          <footer>META DEW TECHNOLOGIES(071 733 6065)</footer>
        </div>
      </div>
    );
  }
}

const DataTable = ({ data }) => {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="tableContainer">
      <table>
        <thead>
          <tr>
            {data[0].map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(1).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
