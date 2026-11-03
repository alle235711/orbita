// File .tex inventati per i test dell'importazione (fetta I): niente file .tex nel repository.

/** Tutti i casi limite del file buono: commenti, graffe, annidamenti, \label, \newtheorem in ogni forma, titoli, sezioni. */
export const TEX_GOOD = String.raw`\documentclass{article}
\usepackage{amsthm}
% \newtheorem{fantasma}{Fantasma}
\newtheorem{thm}{Teorema}
\newtheorem{lem}[thm]{Lemma}
\newtheorem{prop}{Proposizione}[section]
\newtheorem*{oss}{Osservazione}
\newtheorem {cor}
  {Corollario}
\newcommand{\R}{\mathbb{R}}

\begin{document}
\section{Limiti}\label{sec:limiti}

\begin{definizione}[Limite di una successione]\label{def:limite}
Una successione $a_n$ tende a $L$ se per ogni $\varepsilon > 0$ % questo commento sparisce
esiste $N$ tale che $|a_n - L| < \varepsilon$ per $n > N$. Vale il 100\% dei casi.
\end{definizione}

\begin{thm}[Unicità del limite {di Cauchy}]
Il limite, se esiste, è unico:
\[ \lim_{n\to\infty} a_n = L. \]
% \end{thm} dentro un commento non chiude nulla
\begin{itemize}
\item un elenco dentro il teorema
\item e un esempio annidato \begin{esempio} caso $x_{n}$ \end{esempio}
\end{itemize}
\end{thm}

\begin{thm}[Esterno]
Ambiente annidato dello stesso nome:
\begin{thm}[Interno] testo interno \end{thm}
e il testo dopo, che appartiene ancora all'esterno.
\end{thm}

\subsection*{Un po' di esempi}
\begin{esempio}
Senza titolo: $1/n \to 0$.
\end{esempio}
\begin{esempio}
Graffe escapate \{ così \} e annidate {a {b}} con $a_{n}$ \label{ex:due}
\end{esempio}
\begin{lem} Un lemma senza titolo \end{lem}
\begin{thm} Un teorema senza titolo \end{thm}

\section*{Derivate}
\begin{prop}\label{p:derivata}
\begin{equation}\label{eq:uno} f'(x) = \lim_{h \to 0} \frac{f(x+h)-f(x)}{h} \end{equation}
\end{prop}
\begin{oss}Sotto la stella, in una riga.\end{oss}
\begin{cor}[Titolo con {[parentesi]} e {graffe}] Il corollario \(f\) è continua. \end{cor}
\begin{align*}
x &= 1 \\
y &= 2
\end{align*}
\begin{proof} La dimostrazione non è una scheda. \end{proof}
\begin{theorem}[Elenco di serie] Anche i nomi inglesi. \end{theorem}
\begin{exercise} Un ambiente che nell'elenco di serie non c'è. \end{exercise}
\end{document}
`

/** Un altro file, senza \newtheorem: li prende da quello del progetto. */
export const TEX_CHAPTER = String.raw`\section{Capitolo due}
\begin{thm} Teorema del secondo file. \end{thm}
\begin{lem}[Lemma] Lemma del secondo file. \end{lem}
`

/** Un file con un difetto per blocco: i blocchi buoni (Buono, Buona) devono passare lo stesso. */
export const TEX_MALFORMED = String.raw`\section{Prima parte}
\begin{teorema}[Buono] Il primo blocco è buono. \end{teorema}

\begin{corollario}
Graffe {non bilanciate qui
\end{corollario}

\begin{esempio}
Chiuso con l'ambiente sbagliato
\end{osservazione}

\end{lemma}

\begin{xyz}
Ambiente che non conosco
\end{xyz}

\begin{proposizione}[Titolo che non si chiude
testo
\end{proposizione}

\begin{osservazione}
\end{osservazione}

\newtheorem{storto}

\begin{definizione}[Buona] Anche questa passa. \end{definizione}

\begin{lemma}
Questo non è chiuso
`
