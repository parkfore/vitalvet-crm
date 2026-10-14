// 카카오(다음) 우편번호 서비스. 키 없이 무료로 쓸 수 있다.
import { useEffect, useRef, useState } from 'react';

export interface Addr {
    zip: string;
    address: string;
    jibun: string;
    sido: string;
    sigungu: string;
}

declare global {
    interface Window {
        daum?: { Postcode: new (o: { oncomplete: (d: Record<string, string>) => void; width: string; height: string }) => { embed: (el: HTMLElement) => void } };
    }
}

const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loading: Promise<void> | null = null;
const load = () =>
    (loading ??= new Promise<void>((ok, fail) => {
        if (window.daum?.Postcode) return ok();
        const s = document.createElement('script');
        s.src = SRC;
        s.onload = () => ok();
        s.onerror = () => {
            loading = null;
            fail(new Error('load'));
        };
        document.head.appendChild(s);
    }));

export default function AddressSearch({ onPick }: { onPick: (a: Addr) => void }) {
    const box = useRef<HTMLDivElement>(null);
    const [err, setErr] = useState(false);
    useEffect(() => {
        load()
            .then(() => {
                if (!box.current || !window.daum) return;
                new window.daum.Postcode({
                    width: '100%',
                    height: '100%',
                    oncomplete: (d) =>
                        onPick({
                            zip: d.zonecode,
                            address: d.roadAddress || d.address,
                            jibun: d.jibunAddress || d.autoJibunAddress || '',
                            sido: d.sido,
                            sigungu: d.sigungu,
                        }),
                }).embed(box.current);
            })
            .catch(() => setErr(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (err) return <p className="err">주소 검색을 불러오지 못했습니다. 주소를 직접 입력하세요.</p>;
    return <div ref={box} className="addr-box" />;
}
