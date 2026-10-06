import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { Camera, CameraOff, Printer, Search, QrCode } from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { StatusBadge } from '../common';
import { useToast } from '../common/Toast';
import { Book, BookCopy } from '../../types';

const BarcodeDisplay: React.FC<{ value: string }> = ({ value }) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          lineColor: '#1e293b',
        });
      } catch (e) {
        console.error('Barcode error', e);
      }
    }
  }, [value]);

  return <svg ref={ref} className="max-w-full" />;
};

export default function QRBarcode() {
  const { state } = useLibrary();
  const { showToast } = useToast();

  const [selectedBookId, setSelectedBookId] = useState<string>(state.books[0]?.id || '');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<{ book: Book; copy: BookCopy } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedBook = state.books.find((b) => b.id === selectedBookId);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      showToast('Failed to access camera for barcode scanning', 'error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleLookup = () => {
    if (!lookupId) return;

    for (const book of state.books) {
      const copy = book.copies?.find((c) => c.copyId.toLowerCase() === lookupId.toLowerCase() || c.barcode.toLowerCase() === lookupId.toLowerCase());
      if (copy) {
        setLookupResult({ book, copy });
        showToast(`Located copy ${copy.copyId} of "${book.title}"`, 'success');
        return;
      }
    }

    showToast('Book copy or barcode not found in catalog', 'error');
    setLookupResult(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-8 print:p-0 print:m-0 print:space-y-0">
      <div className="print:hidden space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <QrCode className="w-7 h-7 text-indigo-600" />
              QR Code & Barcode Inventory
            </h1>
            <p className="text-sm text-gray-500">Autonomous copy-level tagging, CODE128 barcodes, and physical shelf lookup</p>
          </div>
          <button
            onClick={handlePrint}
            disabled={!selectedBook}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all disabled:opacity-50"
          >
            <Printer size={18} /> Print Copy Labels
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Generation */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <label className="block text-xs font-semibold uppercase text-gray-700">Select Book Catalog Entry</label>
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {state.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} by {b.author} ({b.totalCopies} physical copies)
                  </option>
                ))}
              </select>
            </div>

            {selectedBook && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedBook.copies?.map((copy) => (
                  <div key={copy.copyId} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center text-center space-y-4">
                    <div className="flex justify-between w-full items-center">
                      <span className="font-mono font-bold text-xs bg-gray-100 px-2.5 py-1 rounded-md">{copy.copyId}</span>
                      <StatusBadge status={copy.status} size="sm" />
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <QRCodeSVG
                        value={JSON.stringify({
                          type: 'BOOK_COPY',
                          bookId: selectedBook.id,
                          copyId: copy.copyId,
                          title: selectedBook.title,
                          shelf: copy.shelf,
                        })}
                        size={120}
                        level="H"
                      />
                    </div>

                    <div className="w-full flex justify-center overflow-hidden py-1">
                      <BarcodeDisplay value={copy.copyId} />
                    </div>

                    <div className="w-full pt-2 border-t text-xs text-gray-500 flex justify-between">
                      <span>Condition: <strong>{copy.condition}</strong></span>
                      <span>Shelf: <strong>{copy.shelf}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Scanner / Lookup */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm uppercase">Quick Copy Scanner / Lookup</h3>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  placeholder="Enter Copy ID e.g. BK001-C1..."
                  className="flex-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleLookup}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
                >
                  <Search size={16} />
                </button>
              </div>

              <div>
                {!isCameraActive ? (
                  <button
                    onClick={startCamera}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition"
                  >
                    <Camera size={16} /> Enable Scanner Camera
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={stopCamera}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition"
                    >
                      <CameraOff size={16} /> Stop Camera
                    </button>
                  </div>
                )}
              </div>

              {lookupResult && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-gray-900 text-sm">{lookupResult.book.title}</p>
                  <p className="text-gray-600">Author: {lookupResult.book.author}</p>
                  <p className="text-gray-600">Shelf: <strong>{lookupResult.copy.shelf}</strong></p>
                  <div className="pt-2 flex items-center justify-between">
                    <span>Status: <StatusBadge status={lookupResult.copy.status} size="sm" /></span>
                    <span>Condition: {lookupResult.copy.condition}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print View */}
      <div className="hidden print:block print:w-full">
        {selectedBook && selectedBook.copies && (
          <div className="grid grid-cols-2 gap-4">
            {selectedBook.copies.map((copy) => (
              <div key={copy.copyId} className="border-2 border-gray-800 p-4 rounded-xl flex flex-col items-center text-center break-inside-avoid">
                <h4 className="font-bold text-lg mb-1 truncate w-full">{selectedBook.title}</h4>
                <p className="text-sm text-gray-600 mb-4">{selectedBook.author}</p>

                <div className="flex gap-6 items-center justify-center w-full mb-4">
                  <div className="flex flex-col items-center">
                    <QRCodeSVG
                      value={JSON.stringify({
                        type: 'BOOK_COPY',
                        bookId: selectedBook.id,
                        copyId: copy.copyId,
                        title: selectedBook.title,
                      })}
                      size={120}
                      level="H"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <BarcodeDisplay value={copy.copyId} />
                  </div>
                </div>

                <div className="w-full flex justify-between text-xs font-mono mt-2 pt-2 border-t border-gray-300">
                  <span>{copy.copyId}</span>
                  <span>{copy.shelf}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
